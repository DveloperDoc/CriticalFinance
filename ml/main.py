from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/classify")
def classify(description: str, merchant: str, amount_cents: int, hour: int, dow: int):
    # Dummy classifier: categoriza supermercado si contiene "super"
    if "super" in merchant.lower() or "super" in description.lower():
        return {"category": "alimenticio"}
    return {"category": "otros"}

@app.post("/anomaly")
def anomaly(amount_cents: int):
    # Dummy: marca como anómalo si la transacción supera 100000
    return {"is_anomaly": amount_cents > 100000}
