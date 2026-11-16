from datetime import datetime, timedelta

def _align_to_5_minutes(dt):
    """將 datetime 的分鐘校準至最接近的 5 分鐘倍數，並將秒與微秒歸零。"""
    if not dt:
        return None
    discard = timedelta(
        minutes=dt.minute % 5,
        seconds=dt.second,
        microseconds=dt.microsecond
    )
    dt_floor = dt - discard
    if (dt - dt_floor).total_seconds() >= 150:
        return dt_floor + timedelta(minutes=5)
    return dt_floor

def _parse_time(value):
    if not value:
        return None
    clean = str(value).replace("Z", "").replace("T", " ").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            expected_len = len(datetime.now().strftime(fmt))
            if len(clean) >= expected_len:
                dt = datetime.strptime(clean[:expected_len], fmt)
                return _align_to_5_minutes(dt)
        except ValueError:
            continue
    return None

def test_cases():
    # 測試 1: 剛好是 5 分鐘倍數
    assert _parse_time("2026-11-16 14:15") == datetime(2026, 11, 16, 14, 15)
    # 測試 2: 捨去 (14:12 -> 14:10)
    assert _parse_time("2026-11-16 14:12") == datetime(2026, 11, 16, 14, 10)
    # 測試 3: 進位 (14:13 -> 14:15)
    assert _parse_time("2026-11-16 14:13") == datetime(2026, 11, 16, 14, 15)
    # 測試 4: 跨小時與跨日進位 (23:58 -> 隔日 00:00)
    assert _parse_time("2026-11-16 23:58") == datetime(2026, 11, 17, 0, 0)
    # 測試 5: ISO 'T' 格式與秒數歸零
    assert _parse_time("2026-11-16T14:27:35") == datetime(2026, 11, 16, 14, 30, 0)
    # 測試 6: 空值處理
    assert _parse_time("") is None
    assert _parse_time(None) is None
    print("ALL TIME NORMALIZATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_cases()
