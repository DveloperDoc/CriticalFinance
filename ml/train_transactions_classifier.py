import os
from datetime import datetime

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "transactions_train.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "transaction_classifier.pkl")


def load_data(path: str) -> pd.DataFrame:
    print(f"Cargando dataset desde: {path}")
    df = pd.read_csv(path)

    expected_cols = {
        "txId","userId","accountType","currency","valueCents","type",
        "isRecurring","balanceAfterCents","bookedAt","merchant",
        "description","category"
    }

    missing = expected_cols - set(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas en el dataset: {missing}")

    df["merchant"] = df["merchant"].fillna("")
    df["description"] = df["description"].fillna("")

    df["bookedAt"] = pd.to_datetime(df["bookedAt"], errors="coerce")
    df = df.dropna(subset=["bookedAt"])

    df["month"] = df["bookedAt"].dt.month
    df["day_of_week"] = df["bookedAt"].dt.weekday

    df["text"] = df["description"] + " " + df["merchant"]

    df["balanceAfterCents"] = df["balanceAfterCents"].fillna(0)

    counts = df["category"].value_counts()
    print("Top categorías:")
    print(counts.head(10))

    min_samples = 10
    valid_cats = counts[counts >= min_samples].index
    df = df[df["category"].isin(valid_cats)]

    print(f"Filas finales tras filtro: {len(df)}")

    return df


def build_pipeline():
    text_col = "text"
    num_cols = ["valueCents", "balanceAfterCents", "month", "day_of_week"]
    cat_cols = ["accountType", "currency", "type", "isRecurring"]

    text_transformer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=3,
        max_features=8000,
    )

    num_transformer = StandardScaler()
    cat_transformer = OneHotEncoder(handle_unknown="ignore")

    preprocessor = ColumnTransformer(
        transformers=[
            ("text", text_transformer, text_col),
            ("num", num_transformer, num_cols),
            ("cat", cat_transformer, cat_cols),
        ]
    )

    clf = LogisticRegression(
        max_iter=300,
        n_jobs=-1,
        class_weight="balanced",
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", clf),
        ]
    )

    return model


def main():
    df = load_data(DATA_PATH)

    feature_cols = [
        "text","valueCents","balanceAfterCents","month","day_of_week",
        "accountType","currency","type","isRecurring",
    ]
    X = df[feature_cols].copy()

    # Tipos correctos
    for col in ["accountType", "currency", "type", "isRecurring"]:
        X[col] = X[col].astype(str)

    y = df["category"].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = build_pipeline()

    print("Entrenando modelo...")
    model.fit(X_train, y_train)

    print("Evaluando...")
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Modelo guardado en: {MODEL_PATH}")


if __name__ == "__main__":
    main()
