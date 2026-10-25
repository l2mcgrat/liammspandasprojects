"""Reproducible Pandas analysis for ST-06: Gas Price Collusion & Oligopoly Supergames."""
import numpy as np
import pandas as pd

# 1. Load the cross-country pump price decomposition & concentration table
countries = pd.read_csv("studies-gas-countries.csv")
countries["ex_tax_price_usd_l"] = countries["wholesaleUsdL"] + countries["markupUsdL"]
countries["tax_share_pct"] = (countries["taxUsdL"] / countries["pumpUsdL"] * 100).round(1)
countries["lerner_ex_tax_pct"] = (countries["markupUsdL"] / countries["ex_tax_price_usd_l"] * 100).round(1)
countries["excess_markup_vs_us_cpl"] = ((countries["markupUsdL"] - 0.12) * 100).round(1)

# Exclude state-capped producer monopoly (DZ) when estimating market oligopoly HHI gradient
market_oecd = countries[countries["code"] != "DZ"].copy()
corr_cr4 = market_oecd["cr4Pct"].corr(market_oecd["markupUsdL"])
corr_hhi = market_oecd["hhi"].corr(market_oecd["markupUsdL"])
slope_cpl_per_10pct_cr4 = np.polyfit(market_oecd["cr4Pct"], market_oecd["markupUsdL"] * 100, 1)[0] * 10

print("=== Cross-Country Oligopoly Markup Summary (Pandas) ===")
print(market_oecd[["code", "pumpUsdL", "wholesaleUsdL", "taxUsdL", "markupUsdL", "cr4Pct", "hhi", "lerner_ex_tax_pct"]])
print(f"Correlation(CR4, Ex-Tax Markup): r = {corr_cr4:.3f} | Correlation(HHI, Markup): r = {corr_hhi:.3f}")
print(f"OLS Gradient: +{slope_cpl_per_10pct_cr4:.2f} cents/L markup per +10 percentage points in CR4 concentration\n")

# 2. Asymmetric Pass-Through ("Rockets & Feathers" Error Correction Model)
pt = pd.read_csv("studies-gas-pass-through.csv")
rocket_half_life = pt.loc[pt["rocketPassPct"] >= 50, "day"].min()
feather_half_life = pt.loc[pt["featherPassPct"] >= 50, "day"].min()
cumulative_wedge_cpl_days = np.trapezoid(pt["rocketPassPct"] - pt["featherPassPct"], pt["day"]) / 10.0
print(f"Rocket 50% pass-through lag: {rocket_half_life} day(s) vs. Feather 50% decay lag: {feather_half_life} days")
print(f"Asymmetric tacit rent per 10 c/L wholesale cycle: +{cumulative_wedge_cpl_days:.1f} cent-days/L\n")

# 3. Repeated Bertrand Supergame Incentive-Compatibility (delta >= delta* = 1 - 1/N)
ind = pd.read_csv("studies-gas-industries.csv")
ind["collusive_spne"] = ind["deltaEff"] >= ind["deltaStar"]
print("=== Supergame Incentive-Compatibility (delta_eff vs. delta_star) ===")
print(ind[["id", "industry", "firmsN", "deltaStar", "deltaEff", "slack", "collusive_spne"]])
