import React, { useState, useEffect, useRef } from 'react';
import { User, Users } from 'lucide-react';
import api from '../api';

const UserAvatar = ({ userId, picUrl, isGroup = false, groupId = null, size = 40, style = {} }) => {
    const [imgSrc, setImgSrc] = useState(picUrl);
    const [status, setStatus] = useState(picUrl ? 'loading' : 'failed');
    const imgRef = useRef(null);

    useEffect(() => {
        if (!picUrl) {
            setImgSrc(null);
            setStatus('failed');
            return;
        }
        // 僅在外部傳入的 picUrl 與目前顯示網址確實不同時才重新載入，避免無條件重置已載入狀態
        if (picUrl !== imgSrc) {
            setImgSrc(picUrl);
            setStatus('loading');
        } else if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
            setStatus('loaded');
        }
    }, [picUrl]);

    // 檢查瀏覽器記憶體快取：重新掛載或更新 src 時若圖片已完成解碼，直接標記為 loaded
    useEffect(() => {
        const img = imgRef.current;
        if (img && imgSrc && img.complete && img.naturalWidth > 0) {
            setStatus('loaded');
        }
    }, [imgSrc]);

    const handleError = async () => {
        // If we already refreshed or failed, or if we are currently loading the refreshed image, stop.
        if (status === 'refreshing' || status === 'failed') return;
        if (status === 'loading_refreshed') {
            setStatus('failed');
            setImgSrc(null);
            return;
        }
        
        setStatus('refreshing');
        setImgSrc(null);

        const targetId = isGroup ? (groupId || userId) : userId;
        if (!targetId) {
            setStatus('failed');
            return;
        }

        try {
            let res;
            if (isGroup) {
                // 群組頭像破圖：向群組專用刷新端點請求摘要與頭像
                res = await api.post(`/customers/group/${encodeURIComponent(targetId)}/refresh-summary`);
            } else if (groupId) {
                // 群組成員頭像破圖：向支援 group_id 的端點請求成員頭貼
                res = await api.post(`/customers/${encodeURIComponent(targetId)}/refresh-profile?group_id=${encodeURIComponent(groupId)}`);
            } else {
                // 個人私聊頭像破圖：維持一般 profile 刷新
                res = await api.post(`/customers/${encodeURIComponent(targetId)}/refresh-profile`);
            }

            const newUrl = res.data?.picture_url;
            if (newUrl) {
                setImgSrc(newUrl);
                setStatus('loading_refreshed');
            } else {
                setStatus('failed');
            }
        } catch (err) {
            console.error('Failed to refresh avatar picture:', err);
            setStatus('failed');
        }
    };

    const isGroupPlaceholder = isGroup && status !== 'loaded';

    const containerStyle = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: isGroupPlaceholder ? 'rgba(255, 215, 0, 0.2)' : '#444',
        border: isGroupPlaceholder ? '1px solid var(--primary-yellow)' : 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        ...style
    };

    const showPlaceholder = status !== 'loaded';

    return (
        <div style={containerStyle}>
            {showPlaceholder && (
                isGroup ? (
                    <Users size={size * 0.55} color="var(--primary-yellow)" />
                ) : (
                    <User size={size * 0.6} color="#aaa" />
                )
            )}
            {imgSrc && (status === 'loading' || status === 'loading_refreshed' || status === 'loaded') && (
                <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="avatar"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: status === 'loaded' ? 'static' : 'absolute',
                        opacity: status === 'loaded' ? 1 : 0
                    }}
                    onLoad={() => setStatus('loaded')}
                    onError={handleError}
                />
            )}
        </div>
    );
};

export default UserAvatar;

