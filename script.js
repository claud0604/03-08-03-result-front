// ========== APL Result Page Script ==========

var customerData = null;
var imageUrls = {};
var currentCustomerId = null;

// ========== Theme Toggle ==========
function initTheme() {
    var saved = localStorage.getItem('apl-result-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
}
function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var isDark;
    if (current) {
        isDark = current === 'dark';
    } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('apl-result-theme', next);
}
initTheme();

// ========== Init ==========
document.addEventListener('DOMContentLoaded', function () {
    initScrollPosition();
    applyTranslations();
    initIntroAnimation();

    var urlParams = new URLSearchParams(window.location.search);
    currentCustomerId = urlParams.get('id');

    if (currentCustomerId) {
        // URL has customer ID — show simplified login (phone last 4 only)
        showLoginAfterIntro(true);
    } else {
        // No customer ID — show full login form
        showLoginAfterIntro(false);
    }
});

// ========== Scroll Init ==========
function initScrollPosition() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
}
window.addEventListener('load', function() { setTimeout(function() { window.scrollTo(0, 0); }, 0); });
window.addEventListener('pageshow', function(e) { if (e.persisted) window.scrollTo(0, 0); });

// ========== Intro Animation ==========
function initIntroAnimation() {
    setTimeout(function() {
        var overlay = document.getElementById('introOverlay');
        if (overlay) overlay.classList.add('hidden');
    }, 2300);
}

// ========== Show Login ==========
function showLoginAfterIntro(hasId) {
    setTimeout(function() {
        var overlay = document.getElementById('introOverlay');
        if (overlay) overlay.classList.add('hidden');

        var loginSection = document.getElementById('loginSection');
        if (loginSection) loginSection.style.display = 'flex';

        var customerIdField = document.getElementById('customerIdField');
        var loginDesc = document.getElementById('loginDesc');

        if (hasId) {
            // Hide customer ID field, show simplified message
            if (customerIdField) customerIdField.style.display = 'none';
            if (loginDesc) loginDesc.setAttribute('data-i18n', 'res_verify_subtitle_link');
        } else {
            // Show customer ID field
            if (customerIdField) customerIdField.style.display = 'block';
            if (loginDesc) loginDesc.setAttribute('data-i18n', 'res_verify_subtitle');
        }

        applyTranslations();

        // Phone input: digits only
        var phoneInput = document.getElementById('inputPhoneLast4');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '').slice(0, 4);
            });
        }
    }, 2300);
}

// ========== Handle Verify ==========
function handleVerify(e) {
    e.preventDefault();

    var phoneLast4 = document.getElementById('inputPhoneLast4').value.trim();
    var customerId = currentCustomerId || document.getElementById('inputCustomerId').value.trim();
    var errorEl = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');

    if (!customerId || !phoneLast4) {
        if (errorEl) errorEl.textContent = t('res_error_required');
        return;
    }
    if (!/^\d{4}$/.test(phoneLast4)) {
        if (errorEl) errorEl.textContent = t('res_error_phone4');
        return;
    }

    if (errorEl) errorEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = t('res_verifying'); }

    fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.AUTH_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId, phoneLast4: phoneLast4 })
    })
    .then(function(res) { return res.json(); })
    .then(function(result) {
        if (!result.success) {
            var msgKey = 'res_error_invalid';
            if (result.message && result.message.includes('not yet available')) msgKey = 'res_error_not_ready';
            if (result.message && result.message.includes('not found')) msgKey = 'res_error_not_found';
            if (errorEl) errorEl.textContent = t(msgKey);
            if (btn) { btn.disabled = false; btn.textContent = t('res_verify_btn'); }
            return;
        }

        // Store token and load data
        sessionStorage.setItem('resultToken', result.token);
        currentCustomerId = result.customer.customerId;

        // Update URL if needed
        if (!new URLSearchParams(window.location.search).get('id')) {
            window.history.replaceState({}, '', window.location.pathname + '?id=' + currentCustomerId);
        }

        loadCustomerResult(currentCustomerId);
    })
    .catch(function(err) {
        console.error(err);
        if (errorEl) errorEl.textContent = t('res_error_generic');
        if (btn) { btn.disabled = false; btn.textContent = t('res_verify_btn'); }
    });
}

// ========== Load Customer Result ==========
function loadCustomerResult(customerId) {
    var token = sessionStorage.getItem('resultToken');
    if (!token) {
        showLoginAfterIntro(!!currentCustomerId);
        return;
    }

    var url = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.RESULT.replace('{id}', customerId);

    fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (res.status === 401 || res.status === 403) {
            sessionStorage.removeItem('resultToken');
            showLoginAfterIntro(!!currentCustomerId);
            throw new Error('auth_failed');
        }
        return res.json();
    })
    .then(function(result) {
        if (!result.success) {
            showError(t('res_error_not_found'));
            return;
        }

        customerData = result.data;
        imageUrls = result.imageUrls || {};

        // Hide login, show result
        var loginSection = document.getElementById('loginSection');
        if (loginSection) loginSection.style.display = 'none';

        var resultContainer = document.getElementById('resultContainer');
        if (resultContainer) resultContainer.style.display = '';

        renderResult(customerData);
        window.scrollTo(0, 0);
        initScrollAnimations();
        initFloatingNav();
    })
    .catch(function(err) {
        if (err.message !== 'auth_failed') {
            console.error(err);
            showError(t('res_error_generic'));
        }
    });
}

// ========== Error Display ==========
function showError(msg) {
    var overlay = document.getElementById('introOverlay');
    if (overlay) overlay.classList.add('hidden');

    document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:40px;background:#faf9f7;">' +
        '<p style="font-size:16px;color:#888;text-align:center;line-height:2;">' + msg + '</p>' +
        '<button onclick="window.location.href=window.location.pathname" style="padding:10px 24px;border-radius:20px;border:1px solid #c4a882;background:#fff;color:#8b7355;cursor:pointer;font-size:14px;">Try Again</button>' +
        '</div>';
}

// ========== Resolve Image URL ==========
function resolveImg(key) {
    if (!key) return null;
    if (key.startsWith('data:')) return key;
    if (key.startsWith('http')) return key;
    return imageUrls[key] || null;
}
function resolveImgArray(arr) {
    return (arr || []).map(resolveImg).filter(Boolean);
}

// ========== Eyebrow Style Label ==========
var EYEBROW_STYLE_LABELS = {
    round: { en: 'Round', ko: '라운드', ja: 'ラウンド', zh: '圆弧' },
    ascending: { en: 'Ascending', ko: '상승형', ja: 'アセンディング', zh: '上扬' },
    semi_arch: { en: 'Semi Arch', ko: '세미 아치', ja: 'セミアーチ', zh: '半弧' },
    arch: { en: 'Arch', ko: '아치', ja: 'アーチ', zh: '弧形' },
    straight: { en: 'Straight', ko: '스트레이트', ja: 'ストレート', zh: '平直' }
};
function getEyebrowLabel(code) {
    var lang = getCurrentLang();
    var entry = EYEBROW_STYLE_LABELS[code];
    return entry ? (entry[lang] || entry.en) : code;
}

// ========== Render Result ==========
function renderResult(data) {
    var cd = data.colorDiagnosis || {};
    var fa = data.faceAnalysis || {};
    var ba = data.bodyAnalysis || {};
    var st = data.styling || {};
    var photos = data.customerPhotos || {};
    var gender = data.customerInfo ? data.customerInfo.gender : 'female';
    var genderFolder = gender === 'male' ? 'male' : 'female';

    // Logo + Main Illustration + Tone Table
    var logoImg = document.getElementById('res_logoImg');
    if (logoImg) logoImg.src = 'assets/logo_nobg.png';
    // mainImg src is set directly in HTML for faster loading
    var toneTableImg = document.getElementById('res_toneTableImg');
    if (toneTableImg) toneTableImg.src = 'assets/tonetable.png';

    // Customer name
    setText('res_customerName', data.customerInfo ? data.customerInfo.name : '');

    // Face photos (above-the-fold → eager)
    setPhoto('res_facePhotoFront', resolveImg(photos.face ? photos.face.front : null), true);
    setPhoto('res_facePhotoSide', resolveImg(photos.face ? photos.face.side : null), true);

    // Color diagnosis chips
    setChipActive('res_tempChips', cd.indicators ? cd.indicators.temperature : '');
    setChipActive('res_valueChips', cd.indicators ? cd.indicators.value : '');
    setChipActive('res_chromaChips', cd.indicators ? cd.indicators.chroma : '');
    setChipActive('res_clarityChips', cd.indicators ? cd.indicators.clarity : '');

    // Color type + palette
    setText('res_colorType', cd.type || '');
    var paletteImg = document.getElementById('res_paletteImg');
    if (paletteImg) {
        if (cd.type) {
            var paletteKey = cd.type.toLowerCase().replace(/_/g, '-');
            paletteImg.src = 'https://cdn-r2.apls.kr/02-expert/01-personalcolor-palette/' + genderFolder + '/' + paletteKey + '-panel.jpg';
            paletteImg.style.display = '';
        } else { paletteImg.style.display = 'none'; }
    }

    // Best/Worst colors
    setColorSwatches('res_bestColorSet', cd.bestColors);
    setColorSwatches('res_worstColorSet', cd.worstColors);

    // Tone markers
    renderToneMarkers(cd);

    // Contrast grids
    renderContrastGrid('res_faceContrastGrid', cd.faceContrastLevel, 'contrast-face', genderFolder);
    renderContrastGrid('res_fashionContrastGrid', cd.fashionContrastLevel, 'contrast-outfit', genderFolder);

    // Sliders — Color section
    setSlider('res_colorExampleSlider', 'res_colorExampleBlock', resolveImgArray(cd.colorExamples));
    setMuse('res_museImg', 'res_museComment', 'res_museBlock', resolveImg(cd.makeupMuse ? cd.makeupMuse.imageUrl : null), cd.description || (cd.makeupMuse ? cd.makeupMuse.comment : ''));
    setSlider('res_shadowKeySlider', 'res_shadowKeyBlock', resolveImgArray(cd.makeup ? cd.makeup.shadowBlush : null));
    setSlider('res_shadowProdSlider', 'res_shadowProdBlock', resolveImgArray(cd.productImages ? cd.productImages.shadowBlush : null));
    setSlider('res_lipKeySlider', 'res_lipKeyBlock', resolveImgArray(cd.makeup ? cd.makeup.lip : null));
    setSlider('res_lipProdSlider', 'res_lipProdBlock', resolveImgArray(cd.productImages ? cd.productImages.lip : null));
    setSlider('res_nailSlider', 'res_nailBlock', resolveImgArray(cd.colorUsage ? cd.colorUsage.nail : null));
    setSlider('res_hairSlider', 'res_hairBlock', resolveImgArray(cd.colorUsage ? cd.colorUsage.hair : null));
    setSlider('res_accColorSlider', 'res_accColorBlock', resolveImgArray(cd.colorUsage ? cd.colorUsage.accessory : null));

    // Face analysis
    setPhoto('res_faceCustomerPhoto', resolveImg(photos.face ? photos.face.front : null));
    var faceTypeUrl = fa.typeImageUrl ? resolveImg(fa.typeImageUrl) : null;
    if (!faceTypeUrl && fa.type) {
        var faceTypeFileMap = {
            'OVAL': 'oval.jpg', 'ROUND': 'round.jpg', 'OBLONG': 'oblong.jpg',
            'DIAMOND': 'diamond.jpg', 'SQUARE': 'square.jpg',
            'INVERTED_TRIANGLE': 'inverted-triangle.jpg', 'HEART': 'heart.jpg'
        };
        var faceTypeMaleFileMap = {
            'OVAL': 'oval-male.jpg', 'ROUND': 'round-male.jpg',
            'DIAMOND': 'diamond-male.jpg', 'SQUARE': 'square-male.jpg',
            'INVERTED_TRIANGLE': 'inverted-triangle-male.jpg'
        };
        var ftMap = gender === 'male' ? faceTypeMaleFileMap : faceTypeFileMap;
        var ftFile = ftMap[fa.type];
        if (ftFile) {
            faceTypeUrl = PRESET_API_BASE + '/30-facetype/' + genderFolder + '/' + ftFile;
        }
    }
    setPhoto('res_faceTypeImg', faceTypeUrl);
    setText('res_faceTypeName', fa.type || '');

    // Eyebrow
    setPhoto('res_eyebrowBefore', resolveImg(photos.face ? photos.face.front : null));
    setPhoto('res_eyebrowAfter', resolveImg(fa.eyebrow ? fa.eyebrow.afterImageUrl : null));
    setText('res_eyebrowComment', fa.eyebrow ? fa.eyebrow.comment || '' : '');
    var eyebrowStyleName = (fa.eyebrow && fa.eyebrow.style) ? getEyebrowLabel(fa.eyebrow.style) : '';
    setText('res_eyebrowStyleName', eyebrowStyleName);
    var eyebrowCommentBox = document.getElementById('res_eyebrowCommentBox');
    if (eyebrowCommentBox) eyebrowCommentBox.style.display = (fa.eyebrow && fa.eyebrow.comment) ? '' : 'none';
    toggleBlock('res_eyebrowBlock', !!(fa.eyebrow && (fa.eyebrow.afterImageUrl || fa.eyebrow.comment || fa.eyebrow.style)));

    // Face rec sliders
    setSlider('res_makeupSlider', 'res_makeupBlock', resolveImgArray(fa.makeupRec || fa.makeupExamples));
    setSlider('res_glassesSlider', 'res_glassesBlock', resolveImgArray(fa.glassesRec || fa.glassesRecommendation));
    setSlider('res_accRecSlider', 'res_accRecBlock', resolveImgArray(fa.accessoryRec || fa.accessoryRecommendation));
    setSlider('res_bangsSlider', 'res_bangsBlock', resolveImgArray(fa.bangsRec || fa.bangsRecommendation));
    setSlider('res_backHairSlider', 'res_backHairBlock', resolveImgArray(fa.backHairRec));
    setSlider('res_hairstyleSlider', 'res_hairstyleBlock', resolveImgArray(fa.hairstyleRec || fa.hairstyleExamples));

    // Body
    setText('res_bodySkeletonType', ba.skeletonType || '');
    setText('res_bodySilhouetteType', ba.silhouetteType || '');
    setPhoto('res_bodyFront', resolveImg(photos.body ? photos.body.front : null));
    setPhoto('res_bodySide', resolveImg(photos.body ? photos.body.side : null));
    setText('res_bodyDesc', ba.description || '');
    var bodyDescBox = document.getElementById('res_bodyDescBox');
    if (bodyDescBox) bodyDescBox.style.display = ba.description ? '' : 'none';

    setBestWorst('res_necklineBlock', 'res_bestNecklineSlider', 'res_worstNecklineSlider', 'res_necklineReason', resolveImgArray(ba.bestNecklines), resolveImgArray(ba.worstNecklines), ba.necklineComment);
    setBestWorst('res_collarBlock', 'res_bestCollarSlider', 'res_worstCollarSlider', 'res_collarReason', resolveImgArray(ba.bestCollars), resolveImgArray(ba.worstCollars), ba.collarComment);
    setBestWorst('res_topsBlock', 'res_bestTopSlider', 'res_worstTopSlider', 'res_topsReason', resolveImgArray(ba.bestTopss), resolveImgArray(ba.worstTopss), ba.topsComment);
    // Skirt Length comment
    setText('res_skirtLengthComment', ba.skirtLengthComment || '');
    toggleBlock('res_skirtLengthBlock', !!ba.skirtLengthComment);

    setBestWorst('res_skirtBlock', 'res_bestSkirtSlider', 'res_worstSkirtSlider', 'res_skirtReason', resolveImgArray(ba.bestSkirts), resolveImgArray(ba.worstSkirts), ba.skirtComment);
    setBestWorst('res_pantsBlock', 'res_bestPantsSlider', 'res_worstPantsSlider', 'res_pantsReason', resolveImgArray(ba.bestPantss), resolveImgArray(ba.worstPantss), ba.pantsComment);

    // Styling
    setText('res_styleKeyword', st.keywords && st.keywords.length ? st.keywords.join(', ') : '');
    var rec = st.recommendations || {};
    setSlider('res_outerSlider', 'res_outerBlock', resolveImgArray(rec.outerwear));
    setSlider('res_topSlider', 'res_topBlock', resolveImgArray(rec.tops));
    setSlider('res_dressSlider', 'res_dressBlock', resolveImgArray(rec.dress || rec.overall));
    setSlider('res_bottomSlider', 'res_bottomBlock', resolveImgArray(rec.bottoms));
    setSlider('res_bagSlider', 'res_bagBlock', resolveImgArray(rec.bags));
    setSlider('res_shoesSlider', 'res_shoesBlock', resolveImgArray(rec.shoes));

}

// ========== Render Utilities ==========
function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setPhoto(id, url, eager) {
    var el = document.getElementById(id);
    if (!el) return;
    var loadAttr = eager ? '' : ' loading="lazy"';
    if (url) {
        el.innerHTML = '<img src="' + url + '"' + loadAttr + ' onerror="this.parentElement.innerHTML=\'<span style=color:#bbb;font-size:11px;>' + t('res_no_photo') + '</span>\'">';
    } else {
        el.innerHTML = '<span style="color:#bbb;font-size:11px;">' + t('res_no_photo') + '</span>';
    }
}

function setChipActive(containerId, value) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('.prev-chip-item').forEach(function(item) {
        item.classList.toggle('active', item.getAttribute('data-value') === value);
    });
}

function setColorSwatches(id, colors) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = (colors || []).map(function(c) {
        return '<div style="width:42px;height:42px;border-radius:6px;background:' + c + ';border:1px solid rgba(0,0,0,0.08);"></div>';
    }).join('');
}

function renderToneMarkers(cd) {
    var container = document.getElementById('res_toneChart');
    if (!container) return;
    container.querySelectorAll('.prev-tone-marker').forEach(function(m) { m.remove(); });
    var tones = cd.tones || {};
    function createMarker(toneName, cls) {
        var pos = TONE_POSITIONS[toneName];
        if (!pos) return;
        var m = document.createElement('div');
        m.className = 'prev-tone-marker ' + cls;
        m.style.left = pos.left + '%';
        m.style.top = pos.top + '%';
        container.appendChild(m);
    }
    (tones.main || []).forEach(function(t) { createMarker(t, 'prev-tone-marker-main'); });
    (tones.sub || []).forEach(function(t) { createMarker(t, 'prev-tone-marker-sub'); });
    (tones.point || []).forEach(function(t) { createMarker(t, 'prev-tone-marker-point'); });

    // Show/hide Point legend based on data
    var pointLegend = document.querySelector('.prev-tone-legend-item[data-role="point"]');
    if (pointLegend) pointLegend.style.display = (tones.point && tones.point.length > 0) ? '' : 'none';
}

function renderContrastGrid(gridId, selectedLevel, folder, genderFolder) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    var fileMap = { low: genderFolder + '-low-contrast.png', middle: genderFolder + '-mid-contrast.png', high: genderFolder + '-high-contrast.png' };
    grid.querySelectorAll('.prev-contrast-level').forEach(function(item) {
        var level = item.getAttribute('data-level');
        var img = item.querySelector('.prev-contrast-img');
        if (img) img.src = 'assets/' + folder + '/' + fileMap[level];
        item.classList.toggle('selected', level === selectedLevel);
    });
}

function setSlider(sliderId, blockId, urls) {
    var slider = document.getElementById(sliderId);
    var block = document.getElementById(blockId);
    if (!slider) return;
    var hasData = urls && urls.length > 0;
    if (block) block.style.display = hasData ? '' : 'none';
    if (hasData) {
        slider.innerHTML = urls.map(function(url) {
            return '<div class="prev-slider-card"><img src="' + url + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>';
        }).join('');
    }
}

function setMuse(imgId, commentId, blockId, imgUrl, comment) {
    var block = document.getElementById(blockId);
    var hasData = !!(imgUrl || comment);
    if (block) block.style.display = hasData ? '' : 'none';
    if (hasData) {
        var imgEl = document.getElementById(imgId);
        if (imgEl && imgUrl) imgEl.innerHTML = '<img src="' + imgUrl + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">';
        setText(commentId, comment || '');
        var commentBox = document.getElementById('res_museCommentBox');
        if (commentBox) commentBox.style.display = comment ? '' : 'none';
    }
}

function toggleBlock(blockId, show) {
    var block = document.getElementById(blockId);
    if (block) block.style.display = show ? '' : 'none';
}

function setBestWorst(blockId, bestId, worstId, reasonId, bestUrls, worstUrls, reason) {
    var hasData = (bestUrls && bestUrls.length) || (worstUrls && worstUrls.length);
    var block = document.getElementById(blockId);
    if (block) block.style.display = hasData ? '' : 'none';
    if (hasData) {
        var bestSlider = document.getElementById(bestId);
        var worstSlider = document.getElementById(worstId);
        if (bestSlider) bestSlider.innerHTML = (bestUrls || []).map(function(url) { return '<div class="prev-slider-card"><img src="' + url + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>'; }).join('');
        if (worstSlider) worstSlider.innerHTML = (worstUrls || []).map(function(url) { return '<div class="prev-slider-card"><img src="' + url + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>'; }).join('');
        setText(reasonId, reason || '');
        var reasonBox = document.getElementById(reasonId + 'Box');
        if (reasonBox) reasonBox.style.display = reason ? '' : 'none';
    }
}

// ========== Section Scroll ==========
function scrollToSection(sectionId) {
    var floatNav = document.getElementById('resultFloatNav');
    if (sectionId === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (floatNav) floatNav.classList.remove('menu-open');
        return;
    }
    var target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (floatNav) floatNav.classList.remove('menu-open');
    }
}

// ========== Scroll Animations ==========
function initScrollAnimations() {
    var container = document.getElementById('resultContainer');
    if (!container) return;

    container.querySelectorAll(
        '.prev-section-title, .prev-face-photos, .prev-color-diag, ' +
        '.prev-analysis-result, .prev-block, .prev-color-sets, .prev-keyword-section'
    ).forEach(function(el) {
        el.classList.remove('visible');
        el.classList.add('prev-fade');
    });

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { root: null, threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    container.querySelectorAll('.prev-fade').forEach(function(el) { observer.observe(el); });
}

// ========== Floating Nav ==========
function initFloatingNav() {
    var floatNav = document.getElementById('resultFloatNav');
    var toggleBtn = document.getElementById('resultFloatToggle');
    if (!floatNav || !toggleBtn) return;

    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            floatNav.classList.add('visible');
        } else {
            floatNav.classList.remove('visible', 'menu-open');
        }
    });

    toggleBtn.addEventListener('click', function() { floatNav.classList.toggle('menu-open'); });
}
