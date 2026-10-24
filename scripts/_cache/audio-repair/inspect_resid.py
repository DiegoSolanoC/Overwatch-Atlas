import json
import statistics as st

r = json.load(open("scripts/_cache/audio-repair/repair_report.json", encoding="utf-8"))
print("offset", r["fine_offset_full_s"], "corr", r["fine_corr"])
print("coverage", r["clean_coverage_on_full"])
curve = r["residual_curve"]
resids = [x["resid"] for x in curve]
corrs = [x["corr"] for x in curve]
print(
    "resid median/p90/max",
    round(st.median(resids), 4),
    round(sorted(resids)[int(0.9 * len(resids))], 4),
    round(max(resids), 4),
)
print(
    "corr median/p10/min",
    round(st.median(corrs), 4),
    round(sorted(corrs)[int(0.1 * len(corrs))], 4),
    round(min(corrs), 4),
)
print("Around 28-50s:")
for x in curve:
    if 28 <= x["t"] <= 50:
        flag = " <<<" if x["resid"] >= 0.2 or x["corr"] < 0.7 else ""
        print(f"  t={x['t']:5.2f} resid={x['resid']:.3f} corr={x['corr']:.3f}{flag}")
print("Worst 20 windows:")
for x in sorted(curve, key=lambda z: -z["resid"])[:20]:
    print(f"  t={x['t']:5.2f} resid={x['resid']:.3f} corr={x['corr']:.3f}")
