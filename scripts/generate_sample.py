"""Generate synthetic retail transaction data for demo purposes.

Produces data/sample/sample_transactions.csv with schema matching
the Online Retail UCI dataset (CC BY 4.0).

Usage:
    uv run python scripts/generate_sample.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ── project root on path so utils imports work ──────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from utils.config import get_settings
from utils.logger import get_logger

log = get_logger(__name__)
RNG = np.random.default_rng(42)

# ── catalogue ────────────────────────────────────────────────────────────────
PRODUCTS = [
    ("P001", "WHITE HANGING HEART T-LIGHT HOLDER", 2.95),
    ("P002", "WHITE METAL LANTERN", 3.39),
    ("P003", "CREAM CUPID HEARTS COAT HANGER", 2.75),
    ("P004", "GLASS STAR FROSTED T-LIGHT HOLDER", 3.39),
    ("P005", "HAND WARMER UNION JACK", 1.85),
    ("P006", "HAND WARMER RED POLKA DOT", 1.85),
    ("P007", "ASSORTED COLOUR BIRD ORNAMENT", 1.69),
    ("P008", "POPPY'S PLAYHOUSE BEDROOM", 2.10),
    ("P009", "POPPY'S PLAYHOUSE KITCHEN", 2.10),
    ("P010", "FELTCRAFT PRINCESS CHARLOTTE DOLL", 3.75),
    ("P011", "IVORY KNITTED MUG COSY", 1.65),
    ("P012", "BOX OF 6 ASSORTED COLOUR TEASPOONS", 4.25),
    ("P013", "BOX OF VINTAGE JIGSAW BLOCKS", 6.95),
    ("P014", "BOX OF VINTAGE ALPHABET BLOCKS", 6.95),
    ("P015", "HOME BUILDING BLOCK WORD", 5.95),
    ("P016", "PARTY BUNTING", 4.95),
    ("P017", "JAZZ HEARTS ADDRESS BOOK", 1.65),
    ("P018", "SAVE THE PLANET MUG", 1.25),
    ("P019", "AIRLINE BAG VINTAGE JET SET WHITE", 4.25),
    ("P020", "AIRLINE BAG VINTAGE WORLD CHAMPION", 4.25),
    ("P021", "STRAWBERRY CERAMIC TRINKET BOX", 1.25),
    ("P022", "RECYCLED GLASS CANDLEHOLDER FERN", 2.95),
    ("P023", "RECYCLED GLASS CANDLEHOLDER BIRD", 2.95),
    ("P024", "RECYCLED GLASS CANDLEHOLDER DAISY", 2.95),
    ("P025", "SET OF 4 PANTRY JELLY MOULDS", 3.75),
    ("P026", "RETRO SPOT HEN PARTY NAPKINS", 0.85),
    ("P027", "SET OF 3 CAKE TINS PANTRY DESIGN", 7.95),
    ("P028", "LUNCH BAG SUKI DESIGN", 2.10),
    ("P029", "LUNCH BAG RED RETROSPOT", 2.10),
    ("P030", "LUNCH BAG CARS BLUE", 2.10),
    ("P031", "DOORMAT HEARTS OF GLASS", 9.95),
    ("P032", "BAKING SET 9 PIECE RETROSPOT", 5.95),
    ("P033", "PINK FELT CRAFT TRINKET BOX", 1.95),
    ("P034", "RED FELT CRAFT TRINKET BOX", 1.95),
    ("P035", "BLUE FELT CRAFT TRINKET BOX", 1.95),
    ("P036", "CHILDRENS CUTLERY DOLLY GIRL", 4.15),
    ("P037", "CHILDRENS CUTLERY SPACEBOY", 4.15),
    ("P038", "CHILDRENS CUTLERY CIRCUS PARADE", 4.15),
    ("P039", "MINI PAINT SET VINTAGE", 1.25),
    ("P040", "IVORY KITCHEN SCALES", 7.95),
    ("P041", "EDWARDIAN PARASOL RED", 5.95),
    ("P042", "EDWARDIAN PARASOL NATURAL", 5.95),
    ("P043", "VINTAGE SNAP CARDS", 1.95),
    ("P044", "VINTAGE DOMINOES", 2.95),
    ("P045", "VINTAGE SNAKES AND LADDERS", 3.75),
    ("P046", "SET OF 4 KNICK KNACK TINS POPPIES", 8.50),
    ("P047", "ROUND SNACK BOXES SET OF 4 FRUITS", 9.95),
    ("P048", "WOODLAND CHARLOTTE BAG", 10.95),
    ("P049", "RED RETROSPOT CHARLOTTE BAG", 10.95),
    ("P050", "PINK RETROSPOT CHARLOTTE BAG", 10.95),
    ("P051", "ASSORTED ICE CREAM FRIDGE MAGNETS", 0.85),
    ("P052", "FUNNY ANIMAL MAGNETS PACK OF 6", 0.85),
    ("P053", "SPOTTY BUNTING", 4.95),
    ("P054", "STARS GIFT TAPE", 0.65),
    ("P055", "GINGERBREAD MAN COOKIE CUTTER", 1.25),
    ("P056", "CHRISTMAS HANGING HEART GLASS", 3.25),
    ("P057", "CHRISTMAS TREE STAR DECORATION", 2.10),
    ("P058", "RED RETRO NIGHT LIGHT", 4.25),
    ("P059", "BLUE RETRO NIGHT LIGHT", 4.25),
    ("P060", "NIGHT LIGHT STAR T-LIGHT HOLDER", 3.75),
    ("P061", "SET OF 3 FOLK ART BIRD ORNAMENTS", 6.95),
    ("P062", "FOLK ART STAR HANGING DECORATION", 2.10),
    ("P063", "FOLK ART OWL HANGING DECORATION", 2.10),
    ("P064", "FOLK ART CAT WALL PLAQUE", 5.95),
    ("P065", "KNITTED UNION FLAG HOT WATER BOTTLE", 3.95),
    ("P066", "KNITTED UNION FLAG TEA COSY", 3.95),
    ("P067", "KNITTED UNION FLAG OVEN GLOVE", 3.95),
    ("P068", "RED HANGING HEART T-LIGHT HOLDER", 2.95),
    ("P069", "PINK HANGING HEART T-LIGHT HOLDER", 2.95),
    ("P070", "SILVER HANGING HEART T-LIGHT HOLDER", 2.95),
    ("P071", "PLASTERS IN TIN CIRCUS PARADE", 1.65),
    ("P072", "PLASTERS IN TIN WOODLAND ANIMALS", 1.65),
    ("P073", "PLASTERS IN TIN SPACEBOY", 1.65),
    ("P074", "VICTORIAN SEWING BOX LARGE", 11.95),
    ("P075", "SMALL MARSHMALLOW PINK T-LIGHT HOLDER", 0.85),
    ("P076", "LARGE MARSHMALLOW PINK T-LIGHT HOLDER", 1.25),
    ("P077", "SWEETHEART CERAMIC TRINKET BOX", 1.25),
    ("P078", "BATHROOM METAL SIGN", 3.75),
    ("P079", "GARDEN METAL SIGN", 3.75),
    ("P080", "KITCHEN METAL SIGN", 3.75),
]

COUNTRIES = {
    "United Kingdom": 0.78,
    "Germany": 0.06,
    "France": 0.05,
    "Spain": 0.04,
    "Netherlands": 0.03,
    "Belgium": 0.02,
    "Australia": 0.02,
}

N_CUSTOMERS = 50
N_INVOICES = 300
DATE_START = "2023-01-01"
DATE_END = "2023-12-31"


def _make_product_catalogue() -> pd.DataFrame:
    return pd.DataFrame(PRODUCTS, columns=["StockCode", "Description", "BasePrice"])


def _assign_countries(n: int) -> list[str]:
    countries = list(COUNTRIES.keys())
    weights = list(COUNTRIES.values())
    return RNG.choice(countries, size=n, p=weights).tolist()


def generate_transactions() -> pd.DataFrame:
    """Generate synthetic transaction records matching Online Retail UCI schema."""
    catalogue = _make_product_catalogue()
    customer_ids = [f"C{1000 + i}" for i in range(1, N_CUSTOMERS + 1)]
    customer_countries = {cid: c for cid, c in zip(customer_ids, _assign_countries(N_CUSTOMERS))}

    # Assign cohort-based activity: earlier customers buy more often (power-law)
    customer_weights = RNG.exponential(scale=1.0, size=N_CUSTOMERS)
    customer_weights /= customer_weights.sum()

    dates = pd.date_range(DATE_START, DATE_END, freq="D")
    rows = []
    cancelled_count = 0
    invoice_num = 1

    for _ in range(N_INVOICES):
        invoice_no = f"INV{invoice_num:04d}"
        invoice_num += 1

        # ~5% cancellation rate
        is_cancelled = RNG.random() < 0.05
        if is_cancelled:
            invoice_no = "C" + invoice_no
            cancelled_count += 1

        customer_id = RNG.choice(customer_ids, p=customer_weights)
        country = customer_countries[customer_id]
        inv_date = pd.Timestamp(RNG.choice(dates))

        # 2–8 line items per invoice, weighted random product selection
        n_items = int(RNG.integers(2, 9))
        product_weights = RNG.dirichlet(np.ones(len(catalogue)) * 0.5)
        # Use replace=True then deduplicate to get weighted unique selection
        chosen_idx = RNG.choice(len(catalogue), size=min(n_items * 3, len(catalogue)),
                                replace=True, p=product_weights)
        chosen_idx = list(dict.fromkeys(chosen_idx))[:n_items]  # dedup preserving order
        chosen = catalogue.iloc[chosen_idx]

        for _, prod in chosen.iterrows():
            qty_choices = [1, 2, 3, 4, 6, 12, 24]
            qty_weights = [0.35, 0.25, 0.15, 0.10, 0.08, 0.05, 0.02]
            quantity = RNG.choice(qty_choices, p=qty_weights)
            if is_cancelled:
                quantity = -quantity

            # Price variation ±15% of base price
            price = round(float(prod["BasePrice"]) * RNG.uniform(0.85, 1.15), 2)
            price = max(0.01, price)

            rows.append({
                "InvoiceNo": invoice_no,
                "StockCode": prod["StockCode"],
                "Description": prod["Description"],
                "Quantity": int(quantity),
                "InvoiceDate": inv_date.strftime("%Y-%m-%d %H:%M:%S"),
                "UnitPrice": price,
                "CustomerID": customer_id,
                "Country": country,
            })

    df = pd.DataFrame(rows)
    log.info(f"Generated {len(df)} rows | {N_INVOICES} invoices | {cancelled_count} cancelled | "
             f"{df['CustomerID'].nunique()} customers | {df['StockCode'].nunique()} products")
    return df


def main() -> None:
    settings = get_settings()
    out_path = Path(settings.sample_data_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = generate_transactions()
    df.to_csv(out_path, index=False)
    log.info(f"Saved sample data → {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
