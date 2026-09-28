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

