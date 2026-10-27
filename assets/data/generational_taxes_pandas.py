"""Reproducible Pandas analysis for ST-09: Taxes on Generations Over Time Periods (Real 2024 CAD/Capita)."""
import numpy as np
import pandas as pd

# 1. Load Population-Normalized Generational Fiscal Accounting Table (StatCan DHEA, SHS, Census, CTNS & CIHI)
df = pd.read_csv("studies-gen-tax-cohorts.csv")
df["net_fiscal_reward_cad"] = df["totalRewardCad"] - df["totalTaxCad"]
df["reward_to_tax_ratio"] = (df["totalRewardCad"] / df["totalTaxCad"]).round(2)
df["indirect_excise_share_pct"] = (
    (df["salesTaxCad"] + df["propertyTaxCad"] + df["fuelCarbonCad"] + df["alcoholTaxCad"] + df["vapeTaxCad"])
    / df["totalTaxCad"] * 100
).round(1)

print("=== ST-09: Population-Normalized Generational Tax Burden vs. Fiscal Rewards (2024 CAD/Capita) ===")
print(df[["id", "totalTaxCad", "totalRewardCad", "net_fiscal_reward_cad", "reward_to_tax_ratio", "commuteMins", "fuelCarbonCad", "vapeTaxCad", "propertyTaxCad"]])

# 2. Age-Matched Life-Cycle Comparison: Millennials (2025, Ages 29-44) vs. Boomers (1990, Ages 26-44)
mill_2025 = df.loc[df["id"] == "MILL-2025"].iloc[0]
boom_1990 = df.loc[df["id"] == "BOOM-1990"].iloc[0]
burden_delta = mill_2025["totalTaxCad"] - boom_1990["totalTaxCad"]
commute_delta = mill_2025["commuteMins"] - boom_1990["commuteMins"]
print(f"\nYoung-Adult Life-Cycle Shift (2025 Millennials vs. 1990 Boomers at Same Age):")
print(f"  Real Gross Tax Delta: +${burden_delta:,.0f}/capita (+{burden_delta / boom_1990['totalTaxCad'] * 100:.1f}%)")
print(f"  One-Way Commute Delta: +{commute_delta:.1f} mins ({mill_2025['commuteMins']}m vs {boom_1990['commuteMins']}m) -> Fuel/Carbon Tax ${mill_2025['fuelCarbonCad']}/cap")
