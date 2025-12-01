# ml/main.py
import os
from datetime import datetime

import joblib
from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "transaction_classifier.pkl")

# Cargamos el modelo al iniciar el servicio
print(f"Cargando modelo desde: {MODEL_PATH}")
model = joblib.load(MODEL_PATH)

app = FastAPI(title="CriticalFinance ML Service")


class TxInput(BaseModel):
    description: str | None = ""
    merchant: str | None = ""
    valueCents: int
    bookedAt: datetime

    accountType: str
    currency: str
    type: str           # "debit" | "credit"
    isRecurring: bool = False

    # opcional: si quieres, más adelante puedes enviar balanceAfterCents
    balanceAfterCents: int | None = 0


class TxPrediction(BaseModel):
    category: str
    confidence: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ml/predict-category", response_model=TxPrediction)
def predict_category(tx: TxInput):
    text = f"{tx.description or ''} {tx.merchant or ''}".strip()
    month = tx.bookedAt.month
    day_of_week = tx.bookedAt.weekday()

    # Construimos un DataFrame con UNA fila
    X = pd.DataFrame([{
        "text": text,
        "valueCents": tx.valueCents,
        "balanceAfterCents": tx.balanceAfterCents or 0,
        "month": month,
        "day_of_week": day_of_week,
        "accountType": tx.accountType,
        "currency": tx.currency,
        "type": tx.type,
        "isRecurring": str(tx.isRecurring),
    }])

    # Predicción
    pred = model.predict(X)[0]

    # Confianza
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
        confidence = float(max(probs))
    else:
        confidence = 1.0

    return TxPrediction(
        category=str(pred),
        confidence=confidence
    )

