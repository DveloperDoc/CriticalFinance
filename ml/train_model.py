# ml/train_model.py
import os
import math
import joblib
import pandas as pd
from datetime import datetime

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

# Rutas base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

REAL_CSV = os.path.join(DATASET_DIR, "cartola_labeled.csv")
SYN_CSV = os.path.join(BASE_DIR, "..", "api", "ml", "dataset", "synthetic_dataset.csv")

MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, "transaction_category_model.joblib")


def load_datasets():
    print("Leyendo dataset real desde:", REAL_CSV)
    print("Leyendo dataset sintético desde:", SYN_CSV)

    # Dataset real (cartola)
    df_real = pd.read_csv(REAL_CSV)

    if "merchant" not in df_real.columns:
        df_real["merchant"] = ""

    common_cols = ["date", "description", "amount_clp", "category", "merchant"]

    # Dataset sintético (opcional)
    if os.path.exists(SYN_CSV):
        df_syn = pd.read_csv(SYN_CSV)

        if "category" not in df_syn.columns:
            raise ValueError("El synthetic_dataset.csv debe tener columna 'category'")

        for col in common_cols:
            if col not in df_syn.columns:
                df_syn[col] = "" if col in ["date", "description", "category", "merchant"] else 0

        df_syn = df_syn[common_cols]
        print(f"Filas sintéticas: {len(df_syn)}")
    else:
        print("AVISO: synthetic_dataset.csv NO encontrado. Entrenando solo con datos reales.")
        df_syn = df_real[common_cols].iloc[0:0]

    df_real = df_real[common_cols + [c for c in df_real.columns if c not in common_cols]]

    df = pd.concat([df_real[common_cols], df_syn[common_cols]], ignore_index=True)

    print(f"Total filas para entrenamiento (real + sintético): {len(df)}")

    return df, df_real


def preprocess(df: pd.DataFrame):
    def parse_date(x):
        try:
            return datetime.fromisoformat(str(x))
        except Exception:
            try:
                return datetime.strptime(str(x), "%d/%m/%Y")
            except Exception:
                return None

    dates = df["date"].apply(parse_date)

    df["dow"] = dates.apply(lambda d: d.weekday() if d is not None else -1)
    df["hour"] = dates.apply(lambda d: d.hour if d is not None else -1)

    df["text"] = (df["description"].fillna("") + " " + df["merchant"].fillna("")).str.strip()

    df["amount_clp"] = df["amount_clp"].fillna(0)
    df["amount_log"] = df["amount_clp"].apply(lambda x: math.log1p(abs(x)))

    return df


def build_pipeline():
    text_col = "text"
    num_cols = ["amount_log", "dow", "hour"]

    text_vectorizer = TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        lowercase=True,
    )

    num_transformer = StandardScaler()

    preprocessor = ColumnTransformer(
        transformers=[
            ("text", text_vectorizer, text_col),
            ("num", num_transformer, num_cols),
        ],
        remainder="drop",
    )

    clf = LogisticRegression(
        max_iter=1000,
        multi_class="multinomial",
        n_jobs=-1,
    )

    pipe = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("clf", clf),
        ]
    )

    return pipe


def train_and_eval():
    df, df_real = load_datasets()
    df = preprocess(df)

    # Limpieza: quitar categorías vacías o NaN
    df = df.dropna(subset=["category"])
    df = df[df["category"].astype(str).str.len() > 0]

    y = df["category"].astype(str)
    X = df

    # Revisar distribución de clases
    vc = y.value_counts()
    print("Distribución de clases (category):")
    print(vc)

    min_count = vc.min()
    use_stratify = min_count >= 2

    if not use_stratify:
        print(
            "AVISO: Hay categorías con solo 1 muestra. "
            "Se hará train_test_split SIN stratify."
        )

    if use_stratify:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

    pipe = build_pipeline()

    print("Entrenando modelo de categoría...")
    pipe.fit(X_train, y_train)

    print("Evaluando en test...")
    y_pred = pipe.predict(X_test)
    print(classification_report(y_test, y_pred))

    print("Guardando modelo en:", MODEL_PATH)
    joblib.dump(pipe, MODEL_PATH)

    print("Listo.")


if __name__ == "__main__":
    train_and_eval()
