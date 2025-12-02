# ml/inference_service.py
import os
import math
from datetime import datetime

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "transaction_category_model.joblib")

print("Cargando modelo desde:", MODEL_PATH)
model = joblib.load(MODEL_PATH)

app = FastAPI(title="Transaction Category Inference")


class TxInput(BaseModel):
    date: str          # ISO string o "dd/mm/YYYY"
    description: str
    merchant: str = ""
    amount_clp: float


class TxPrediction(BaseModel):
    category: str
    is_gasto_hormiga: bool


def parse_date(x: str):
    try:
        return datetime.fromisoformat(x)
    except Exception:
        try:
            return datetime.strptime(x, "%d/%m/%Y")
        except Exception:
            return None


def apply_rule_based_category(tx: TxInput) -> tuple[str, bool] | None:
    """
    Reglas duras para casos que el modelo maneja mal:
    intereses, servicios básicos, restaurantes, e-commerce.
    Devuelve (category, is_gasto_hormiga) o None si no aplica.
    """
    text = f"{tx.description} {tx.merchant}".lower()
    monto = tx.amount_clp

    # 1) Intereses
    if "interes" in text or "interés" in text:
        # para ti, intereses NO son gasto hormiga
        return "INTERESES", False

    # 2) Servicios básicos (no los consideramos hormiga en general)
    servicios_basicos = ["enel", "essbio", "aguas andinas", "vtr", "movistar", "entel", "wom", "claro"]
    if any(s in text for s in servicios_basicos):
        return "Servicios", False

    # 3) Restaurantes / cafés / bares
    restaurantes_kw = [
        "cafe", "cafetería", "cafeteria", "restaurant", "restaurante",
        "bar ", "pub ", "sushi", "pizza", "kfc", "burger king", "mcdonald",
        "mc donald", "telepizza", "domino", "poeta"
    ]
    if any(k in text for k in restaurantes_kw):
        # Monto pequeño -> gasto hormiga
        is_hormiga = monto <= 5000
        # usa la etiqueta que estás usando en el dataset para este tipo
        return "RESTAURANTE_CAFE", is_hormiga

    # 4) E-commerce / pagos online (MercadoPago, etc.)
    ecommerce_kw = ["mercadopago", "paypal", "aliexpress", "mercado libre", "mercadolibre"]
    if any(k in text for k in ecommerce_kw):
        is_hormiga = monto <= 5000
        return "E_COMMERCE", is_hormiga

    # Nada de lo anterior aplica
    return None


@app.post("/predict", response_model=TxPrediction)
def predict(tx: TxInput):
    # 0) Reglas duras primero
    rule_result = apply_rule_based_category(tx)
    if rule_result is not None:
        category, is_hormiga = rule_result
        return TxPrediction(category=category, is_gasto_hormiga=is_hormiga)

    # 1) Preparar features como en el entrenamiento
    d = parse_date(tx.date)
    if d is None:
        d = datetime.now()

    dow = d.weekday()
    hour = d.hour
    amount_log = math.log1p(abs(tx.amount_clp))

    text = f"{tx.description or ''} {tx.merchant or ''}".strip()

    df = pd.DataFrame(
        [{
            "date": tx.date,
            "description": tx.description,
            "merchant": tx.merchant,
            "amount_clp": tx.amount_clp,
            "amount_log": amount_log,
            "dow": dow,
            "hour": hour,
            "text": text,
        }]
    )

    pred_category = model.predict(df)[0]

    # 2) Regla general de gasto hormiga usando categoría predicha
    hormiga_cats = {
        "SUPERMERCADO_MINIMARKET",
        "RESTAURANTE_CAFE",
        "E_COMMERCE",
        "SUSCRIPCION_DIGITAL",
        "OTRAS_COMPRAS",
        "Alimentación",
        "Restaurantes",
        "Entretenimiento",
    }

    is_gasto_hormiga = tx.amount_clp <= 5000 and str(pred_category) in hormiga_cats

    return TxPrediction(
        category=str(pred_category),
        is_gasto_hormiga=is_gasto_hormiga,
    )
