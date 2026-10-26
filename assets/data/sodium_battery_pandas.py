"""Reproducible Pandas analysis for ST-05: Sodium Battery Technology vs. Lithium-Ion."""
import numpy as np
import pandas as pd

# 1. Periodic Table & Faraday Law Fundamental Ratios
F = 96485.3321  # C/mol
M_Li, M_Na = 6.94, 22.99  # g/mol
r_Li, r_Na = 0.76, 1.02   # Shannon 6-coord octahedral ionic radius (Angstroms)
E0_Li, E0_Na = -3.04, -2.71  # V vs SHE

q_Li = F / (3.6 * M_Li)  # 3861 mAh/g
q_Na = F / (3.6 * M_Na)  # 1166 mAh/g
vol_ratio = (r_Na / r_Li) ** 3

print(f"Theoretical metal specific capacity: Li = {q_Li:.0f} mAh/g vs. Na = {q_Na:.0f} mAh/g")
print(f"Shannon ionic volume expansion (Na+/Li+)^3: {vol_ratio:.2f}x | Potential shift: +{E0_Na - E0_Li:.2f} V")

# 2. Load 6-chemistry benchmark table & compute Levelized Cost of Storage (LCOS $/MWh-cycle)
df = pd.read_csv("studies-sodium-chemistries.csv")
df["cost_per_1000_cycles_usd_kwh"] = (df["cellCostUsdKwh"] / (df["cycleLife"] / 1000.0)).round(2)
df["winter_effective_wh_kg_minus20C"] = (df["gravWhKg"] * df["tempRetMinus20Pct"] / 100.0).round(1)

print("\n=== Sodium-Ion vs. Lithium-Ion Chemistry Matrix (Pandas) ===")
print(df[["id", "gravWhKg", "cellCostUsdKwh", "cycleLife", "tempRetMinus20Pct", "cost_per_1000_cycles_usd_kwh", "winter_effective_wh_kg_minus20C"]])
