"""業務規則檢查：AI 負責看，程式負責驗算。

處理原則（已與使用者確認）：
- 🔧 自動修正（結果可確定）：type → format 對照、二聯式 sales / tax 反推、金額四捨五入
- ⚠️ 只警告（需要人判斷）：發票號碼格式、統編檢查碼、金額加總、稅額比例、日期合理性
"""

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from schemas import TYPE_TO_FORMAT, InvoiceData, RuleWarning

FIELD_LABELS = {
    "type": "發票類型",
    "format": "稅額編碼",
    "invoice_number": "發票號碼",
    "date": "開立日期",
    "buyer_taxno": "買受人統編",
    "seller_taxno": "賣方統編",
    "tax_type": "課稅別",
    "sales": "銷售額",
    "tax": "稅額",
    "total": "總計",
}
AMOUNT_FIELDS = ("sales", "tax", "total")
TAXNO_FIELDS = ("buyer_taxno", "seller_taxno")

INVOICE_NUMBER_PATTERN = re.compile(r"^[A-Z]{2}\d{8}$")   # 2 個大寫英文字母 + 8 位數字
TAXNO_PATTERN = re.compile(r"^\d{8}$")                     # 8 位數字
DATE_PATTERN = re.compile(r"^(\d{1,4})-(\d{1,2})-(\d{1,2})$")
TAXNO_WEIGHTS = (1, 2, 1, 2, 1, 2, 4, 1)                  # 統編檢查碼的加權數
TAX_RATE = Decimal("0.05")
DUAL_CASHIER_DIVISOR = Decimal("1.05")


# ───────────────────────── 共用小工具 ─────────────────────────

def round_half_up(value: Decimal | int | float) -> int:
    """四捨五入取整數。

    注意：Python 內建的 round() 是「銀行家捨入」，round(2.5) 會得到 2，
    不符合業務規則「四捨五入」，所以改用 Decimal 的 ROUND_HALF_UP。
    """
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def parse_amount(value) -> tuple[int | None, bool]:
    """把 AI 給的金額轉成整數，回傳（整數, 是否經過四捨五入）。

    AI 可能給 1000、1000.4、"1,000"、"NT$1,000" 等各種寫法。
    無法解讀時拋出 ValueError。
    """
    if value is None:
        return None, False
    if isinstance(value, bool):          # True / False 在 Python 裡也算整數，要先排除
        raise ValueError
    if isinstance(value, int):
        return value, False

    text = str(value).replace(",", "").replace("NT$", "").replace("$", "").strip()
    if text == "" or text.lower() == "null":
        return None, False
    try:
        number = Decimal(text)
    except InvalidOperation as e:
        raise ValueError from e
    rounded = round_half_up(number)
    return rounded, number != rounded


def clean_text(value) -> str | None:
    """去掉前後空白；空字串或 "null" 視為 None。"""
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() in ("null", "none"):
        return None
    return text


def to_int_or_none(value) -> int | None:
    """轉成整數，失敗就回傳 None。"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def is_valid_taxno(taxno: str) -> bool:
    """統一編號檢查碼驗證（財政部規則，含 2023 年擴充）。

    1. 8 位數字分別乘上加權數 1,2,1,2,1,2,4,1
    2. 每個乘積的十位數與個位數相加，再全部加總
    3. 總和能被 5 整除即為有效
    4. 特例：第 7 位是 7 時（7 × 4 = 28），總和「加 1」後能被 5 整除也算有效
    """
    if not TAXNO_PATTERN.match(taxno):
        return False
    digits = [int(ch) for ch in taxno]
    total = 0
    for digit, weight in zip(digits, TAXNO_WEIGHTS):
        product = digit * weight
        total += product // 10 + product % 10
    if total % 5 == 0:
        return True
    return digits[6] == 7 and (total + 1) % 5 == 0


# ───────────────────────── 主要入口 ─────────────────────────

def apply_rules(raw: dict) -> tuple[InvoiceData, list[RuleWarning]]:
    """對 AI 的原始結果做清理、自動修正與檢查，回傳（發票資料, 提醒清單）。"""
    warnings: list[RuleWarning] = []

    data = _normalize(raw, warnings)            # 1. 清理格式
    _fix_format(data, warnings)                 # 2. 🔧 type → format
    _fix_dual_cashier_amounts(data, warnings)   # 3. 🔧 二聯式反推 sales / tax
    _check_invoice_number(data, warnings)       # 4. ⚠️ 發票號碼格式
    _check_taxnos(data, warnings)               # 5. ⚠️ 統編
    _check_amounts(data, warnings)              # 6. ⚠️ 金額加總與稅額比例
    _check_date(data, warnings)                 # 7. ⚠️ 日期

    return InvoiceData(**data), warnings


# ───────────────────────── 1. 清理格式 ─────────────────────────

def _normalize(raw: dict, warnings: list[RuleWarning]) -> dict:
    """把 AI 回傳的各種寫法統一成標準格式。"""
    data: dict = {}

    # 發票類型：只接受本案的三種
    invoice_type = clean_text(raw.get("type"))
    if invoice_type in TYPE_TO_FORMAT:
        data["type"] = invoice_type
    else:
        data["type"] = None
        if invoice_type is not None:
            _warn(warnings, "type", f"無法判斷的發票類型「{invoice_type}」，請人工確認")

    data["format"] = to_int_or_none(raw.get("format"))

    # 發票號碼：轉大寫，去掉空白與連字號（票面常印成 MY-27951864）
    number = clean_text(raw.get("invoice_number"))
    data["invoice_number"] = re.sub(r"[\s-]", "", number).upper() if number else None

    data["date"] = clean_text(raw.get("date"))

    for field in TAXNO_FIELDS:
        taxno = clean_text(raw.get(field))
        data[field] = re.sub(r"[\s-]", "", taxno) if taxno else None

    # 課稅別：只接受 0 / 1 / 2
    tax_type = to_int_or_none(raw.get("tax_type"))
    if tax_type not in (0, 1, 2):
        if raw.get("tax_type") is not None:
            _warn(warnings, "tax_type", f"無法判斷的課稅別「{raw.get('tax_type')}」，請人工確認")
        tax_type = None
    data["tax_type"] = tax_type

    # 金額：統一轉成整數
    for field in AMOUNT_FIELDS:
        try:
            value, was_rounded = parse_amount(raw.get(field))
        except ValueError:
            value, was_rounded = None, False
            _warn(warnings, field, f"無法解讀的金額「{raw.get(field)}」，請人工確認")
        if was_rounded:
            _fixed(warnings, field, f"{FIELD_LABELS[field]}已四捨五入為整數 {value}")
        data[field] = value

    data["currency"] = "TWD"
    return data


# ───────────────────────── 2～3. 自動修正 ─────────────────────────

def _fix_format(data: dict, warnings: list[RuleWarning]) -> None:
    """🔧 稅額編碼由發票類型決定，兩者不符時以類型為準。"""
    expected = TYPE_TO_FORMAT.get(data["type"])
    if expected is None or data["format"] == expected:
        return
    old = data["format"]
    data["format"] = expected
    if old is None:
        _fixed(warnings, "format", f"依發票類型補上稅額編碼 {expected}")
    else:
        _fixed(warnings, "format", f"依發票類型將稅額編碼由 {old} 修正為 {expected}")


def _fix_dual_cashier_amounts(data: dict, warnings: list[RuleWarning]) -> None:
    """🔧 二聯式只有總計，銷售額與稅額一律由總計反推。"""
    if data["type"] != "tw_dual_cashier" or data["total"] is None:
        return
    total = data["total"]
    expected_sales = round_half_up(Decimal(total) / DUAL_CASHIER_DIVISOR)
    expected_tax = total - expected_sales

    for field, expected in (("sales", expected_sales), ("tax", expected_tax)):
        if data[field] != expected:
            old = data[field]
            data[field] = expected
            _fixed(warnings, field, f"二聯式依總計反推{FIELD_LABELS[field]}：{old} → {expected}")


# ───────────────────────── 4～7. 檢查並警告 ─────────────────────────

def _check_invoice_number(data: dict, warnings: list[RuleWarning]) -> None:
    number = data["invoice_number"]
    if number is not None and not INVOICE_NUMBER_PATTERN.match(number):
        _warn(warnings, "invoice_number", "發票號碼應為 2 個大寫英文字母 + 8 位數字")


def _check_taxnos(data: dict, warnings: list[RuleWarning]) -> None:
    for field in TAXNO_FIELDS:
        taxno = data[field]
        if taxno is None:
            continue
        if not TAXNO_PATTERN.match(taxno):
            _warn(warnings, field, f"{FIELD_LABELS[field]}應為 8 位數字")
        elif not is_valid_taxno(taxno):
            _warn(warnings, field, f"{FIELD_LABELS[field]}檢查碼不符，可能有數字辨識錯誤")


def _check_amounts(data: dict, warnings: list[RuleWarning]) -> None:
    """三聯式（含收銀機三聯）有分別列出銷售額與稅額，檢查是否合理。二聯式已由總計反推，不需檢查。"""
    if data["type"] == "tw_dual_cashier":
        return
    sales, tax, total = data["sales"], data["tax"], data["total"]

    if sales is not None and tax is not None and total is not None and sales + tax != total:
        _warn(warnings, "total", f"銷售額 + 稅額（{sales} + {tax} = {sales + tax}）與總計 {total} 不符")

    if data["tax_type"] == 0 and sales is not None and tax is not None:
        expected_tax = round_half_up(Decimal(sales) * TAX_RATE)
        if abs(tax - expected_tax) > 1:
            _warn(warnings, "tax", f"稅額 {tax} 與銷售額 × 5%（約 {expected_tax}）相差超過 1 元")


def _check_date(data: dict, warnings: list[RuleWarning]) -> None:
    text = data["date"]
    if text is None:
        return
    match = DATE_PATTERN.match(text)
    if not match:
        _warn(warnings, "date", "日期格式應為 YYYY-MM-DD")
        return

    year, month, day = (int(part) for part in match.groups())
    if year < 1912:
        _warn(warnings, "date", f"年份 {year} 疑似民國年未轉換（西元年 = 民國年 + 1911）")
        return
    try:
        parsed = date(year, month, day)
    except ValueError:
        _warn(warnings, "date", f"日期 {text} 不存在")
        return

    data["date"] = parsed.isoformat()          # 統一補零，例如 2023-6-3 → 2023-06-03
    if parsed > date.today():
        _warn(warnings, "date", "開立日期晚於今天，請確認")


# ───────────────────────── 產生提醒 ─────────────────────────

def _fixed(warnings: list[RuleWarning], field: str, message: str) -> None:
    warnings.append(RuleWarning(field=field, level="fixed", message=message))


def _warn(warnings: list[RuleWarning], field: str, message: str) -> None:
    warnings.append(RuleWarning(field=field, level="warn", message=message))
