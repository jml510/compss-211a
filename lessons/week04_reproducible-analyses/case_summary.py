"""Shared summary of the San Francisco 311 extract."""

def summarize_requests(requests, group_by="district"):
    """Count every request; summarize available, nonnegative closure durations."""
    summary = (
        requests.groupby(group_by, dropna=False)["hours_to_close"]
        .agg(requests="size", with_time="count", median_hours="median")
        .round(2)
        .reset_index()
    )
    return summary

def category_report(requests, category, group_by="district"):
    """Summarize requests by category."""
    selected = requests.loc[requests["category"] == category]
    report = summarize_requests(selected, group_by=group_by)
    report["pct_with_time"] = report["with_time"] / report["requests"] * 100
    return report