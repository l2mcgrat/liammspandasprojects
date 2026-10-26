"""Reproducible Pandas analysis for ST-08: AI Compute, Token Inference & Training Cost Economics."""
import numpy as np
import pandas as pd

# 1. Load Frontier vs. Open-Weight AI Model Cost & Capability Benchmark Table
df = pd.read_csv("studies-ai-cost-models.csv")
baseline_cost = df.loc[df["id"] == "GPT4-2023", "blendedUsdM"].iloc[0]
df["deflation_multiple_vs_2023"] = (baseline_cost / df["blendedUsdM"]).round(1)
df["accuracy_points_per_dollar"] = (df["benchmarkPct"] / df["blendedUsdM"]).round(2)
df["queries_per_kwh"] = (1000.0 / df["energyWhQuery"]).round(0)

print("=== ST-08: AI Inference Deflation & Training Capex Matrix (Pandas) ===")
print(df[["id", "blendedUsdM", "deflation_multiple_vs_2023", "trainCapexUsdM", "energyWhQuery", "benchmarkPct", "accuracy_points_per_dollar"]])

# 2. Enterprise Cascade Routing Simulation (100M monthly tokens: 85% Flash + 15% Argon High)
flash_cost = df.loc[df["id"] == "FLASH-38", "blendedUsdM"].iloc[0]
argon_cost = df.loc[df["id"] == "ARGON-HIGH", "blendedUsdM"].iloc[0]
all_argon_monthly = 100.0 * argon_cost
cascade_monthly = 100.0 * (0.85 * flash_cost + 0.15 * argon_cost)
savings_pct = (1.0 - cascade_monthly / all_argon_monthly) * 100.0
print(f"\n100M Token/Month Enterprise Workload: All-Frontier = ${all_argon_monthly:,.2f} vs. Cascade = ${cascade_monthly:,.2f} ({savings_pct:.1f}% savings)")
