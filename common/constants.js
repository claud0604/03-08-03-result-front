// ========== APL facefree2026 Result Page — Constants ==========

var API_CONFIG = {
    BASE_URL: 'https://api-030803-result.apls.kr',
    ENDPOINTS: {
        AUTH_VERIFY: '/api/auth/verify',
        RESULT: '/api/result/{id}',
        NOTIFY_SEND: '/api/notify/send',
        CHRONICLE: '/api/chronicle/{id}',
        CHRONICLE_VERSION: '/api/chronicle/{id}/{version}'
    }
};

// R2 preset images via CDN
var PRESET_API_BASE = 'https://cdn-r2.apls.kr/02-expert';
var EXPERT_API_BASE = 'https://api-030802-expert.apls.kr';

// Tone chart marker positions (percentage-based)
// Synced with Expert TONE_GRID coordinates
var TONE_POSITIONS = {
    'Wh':   { left: 18.5,  top: 16.5 },
    'ltgy': { left: 18.25, top: 34 },
    'G':    { left: 18.25, top: 51.75 },
    'dkgy': { left: 18.25, top: 69.75 },
    'bk':   { left: 18.25, top: 87.6 },
    'Pl':   { left: 39,    top: 25.75 },
    'Sf':   { left: 39,    top: 43.5 },
    'dl':   { left: 39,    top: 61.5 },
    'dk':   { left: 39,    top: 79.25 },
    'Lt':   { left: 59.75, top: 33.25 },
    'basic':{ left: 59.75, top: 51.25 },
    'Dp':   { left: 59.75, top: 69.25 },
    'Vv':   { left: 80.5,  top: 51.5 }
};
