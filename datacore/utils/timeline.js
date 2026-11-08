// Pure date-bucketing helpers for note-creation timelines (currently used by
// the Resources dashboard's creation timeline).
//
//   const timeline = await dc.require("Z. Meta/datacore/utils/timeline.js");
//
// Input shape expected everywhere below:
//   resources: [{ name, path, link, timestamp: Luxon DateTime | null }]
// Items with a null/undefined timestamp are never bucketed.

const { DateTime } = dc.luxon;

const RANGE_PRESETS = [
    { id: "7d", label: "Last week", days: 7 },
    { id: "14d", label: "Last 2 weeks", days: 14 },
    { id: "30d", label: "Last month", days: 30 },
    { id: "90d", label: "Last 3 months", days: 90 },
    { id: "180d", label: "Last 6 months", days: 180 },
    { id: "365d", label: "Last year", days: 365 },
    { id: "all", label: "All time", days: null },
];

function granularityForSpan(spanDays) {
    if (spanDays <= 31) return "day";
    if (spanDays <= 365) return "week";
    return "month";
}

function bucketStart(dt, granularity) {
    return dt.startOf(granularity);
}

function nextBucket(dt, granularity) {
    return dt.plus({ [`${granularity}s`]: 1 });
}

function bucketLabel(dt, granularity) {
    if (granularity === "month") return dt.toFormat("LLL yyyy");
    return dt.toFormat("LLL dd");
}

function resolveRange(rangeId, resources, customRange, now = DateTime.now()) {
    if (rangeId === "custom" && customRange?.start && customRange?.end) {
        return { start: customRange.start.startOf("day"), end: customRange.end.endOf("day") };
    }
    if (rangeId === "all") {
        const dated = resources.filter((r) => r.timestamp);
        if (dated.length === 0) return { start: now.startOf("day"), end: now.endOf("day") };
        const minTs = dated.reduce((min, r) => (r.timestamp < min ? r.timestamp : min), dated[0].timestamp);
        return { start: minTs.startOf("day"), end: now.endOf("day") };
    }
    const preset = RANGE_PRESETS.find((p) => p.id === rangeId) ?? RANGE_PRESETS[2];
    return { start: now.minus({ days: preset.days }).startOf("day"), end: now.endOf("day") };
}

function buildBuckets({ resources, start, end }) {
    const spanDays = Math.max(1, end.diff(start, "days").days);
    const granularity = granularityForSpan(spanDays);

    const buckets = [];
    const byKey = new Map();

    let cursor = bucketStart(start, granularity);
    const endBoundary = bucketStart(end, granularity);
    while (cursor <= endBoundary) {
        const key = cursor.toISODate();
        const bucket = { key, start: cursor, label: bucketLabel(cursor, granularity), count: 0, items: [] };
        buckets.push(bucket);
        byKey.set(key, bucket);
        cursor = nextBucket(cursor, granularity);
    }

    resources.forEach((r) => {
        if (!r.timestamp) return;
        if (r.timestamp < start || r.timestamp > end) return;
        const bucket = byKey.get(bucketStart(r.timestamp, granularity).toISODate());
        if (!bucket) return;
        bucket.count += 1;
        bucket.items.push(r);
    });

    return { granularity, buckets };
}

return { RANGE_PRESETS, granularityForSpan, resolveRange, buildBuckets };
