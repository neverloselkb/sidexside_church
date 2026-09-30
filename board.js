/**
 * 나란히교회 Supabase 게시판 스크립트
 * - 관리자 전용 글/사진 등록 및 삭제
 * - 방문자 전체 열람 및 카테고리 필터/검색
 * - 브라우저 기반 고화질 자동 압축 (1GB 무료 스토리지 최적화)
 */

let sbClient = null;
let currentPosts = [];
let activeCategory = "전체";
let searchQuery = "";
let currentUser = null;
let currentPage = 1;
const POSTS_PER_PAGE = 6;
let preparedImageFile = null;

// DOM 로드 완료 후 초기화
document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
    initBoardEvents();
});

/* =========================================================================
   1. Supabase 초기화 및 인증 세션 감지
   ========================================================================= */
function initSupabase() {
    const isConfigured = typeof SUPABASE_URL !== 'undefined' && 
                         typeof SUPABASE_ANON_KEY !== 'undefined' &&
                         SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" &&
                         SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

    if (!isConfigured) {
        showBoardEmptyState("Supabase 설정이 필요합니다.<br><small style='color:#888;'>supabase-config.js 파일에 URL과 anon 키를 입력해주세요.</small>");
        return;
    }

    try {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // 현재 로그인 세션 확인
        sbClient.auth.getSession().then(({ data: { session } }) => {
            updateAdminUI(session ? session.user : null);
        });

        // 인증 상태 변경 감지
        sbClient.auth.onAuthStateChange((_event, session) => {
            updateAdminUI(session ? session.user : null);
        });

        // 초기 게시글 목록 로드
        fetchPosts();
    } catch (err) {
        console.error("Supabase 초기화 오류:", err);
        showBoardEmptyState("게시판을 불러오는 중 오류가 발생했습니다.");
    }
}

/* =========================================================================
   2. 게시글 불러오기 및 렌더링 (페이징 지원)
   ========================================================================= */
async function fetchPosts() {
    if (!sbClient) return;

    const listContainer = document.getElementById("board-list");
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="board-loading">
            <i class="fas fa-spinner fa-spin"></i> 소식을 불러오고 있습니다...
        </div>
    `;

    try {
        const { data, error } = await sbClient
            .from("posts")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        currentPosts = data || [];
        renderPosts();
    } catch (err) {
        console.error("게시글 로드 실패:", err);
        showBoardEmptyState("게시글을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
}

function renderPosts() {
    const listContainer = document.getElementById("board-list");
    if (!listContainer) return;

    // 카테고리 및 검색 필터링
    let filtered = currentPosts;

    if (activeCategory !== "전체") {
        filtered = filtered.filter(p => p.category === activeCategory);
    }

    if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(p => 
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.content && p.content.toLowerCase().includes(query))
        );
    }

    if (filtered.length === 0) {
        showBoardEmptyState("등록된 소식이 없습니다.");
        return;
    }

    // 페이징 계산
    const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + POSTS_PER_PAGE);

    listContainer.innerHTML = paginated.map(post => {
        const formattedDate = formatDate(post.created_at);
        const hasImage = !!post.image_url;
        const categoryClass = getCategoryClass(post.category);

        return `
            <article class="board-card" onclick="openDetailModal(${post.id})">
                ${hasImage ? `
                    <div class="card-thumb-wrap">
                        <img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}" loading="lazy">
                    </div>
                ` : `
                    <div class="card-thumb-wrap text-only">
                        <i class="fas fa-newspaper"></i>
                    </div>
                `}
                <div class="card-body">
                    <div class="card-meta">
                        <span class="category-badge ${categoryClass}">${escapeHtml(post.category || '공지')}</span>
                        <span class="card-date">${formattedDate}</span>
                    </div>
                    <h3 class="card-title">${escapeHtml(post.title)}</h3>
                    <p class="card-snippet">${escapeHtml(post.content)}</p>
                    <div class="card-footer">
                        <span class="read-more">자세히 보기 <i class="fas fa-chevron-right"></i></span>
                        ${currentUser ? `
                            <button class="btn-card-delete" onclick="event.stopPropagation(); deletePost(${post.id}, '${escapeHtml(post.image_url || '')}')" title="삭제">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join("");

    renderPagination(totalPages, filtered.length);
}

function renderPagination(totalPages, totalCount) {
    const pagContainer = document.getElementById("board-pagination");
    if (!pagContainer) return;

    if (totalPages <= 1) {
        pagContainer.innerHTML = "";
        return;
    }

    let html = '';

    // 이전 페이지 버튼
    html += `
        <button class="page-btn page-arrow" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} aria-label="이전 페이지">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // 페이지 번호 생성 (최대 5개 표시 및 생략 ... 처리)
    let startPage = 1;
    let endPage = totalPages;

    if (totalPages > 5) {
        if (currentPage <= 3) {
            startPage = 1;
            endPage = 5;
        } else if (currentPage + 2 >= totalPages) {
            startPage = totalPages - 4;
            endPage = totalPages;
        } else {
            startPage = currentPage - 2;
            endPage = currentPage + 2;
        }
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span class="page-ellipsis">...</span>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        html += `
            <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">
                ${p}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="page-ellipsis">...</span>`;
        }
        html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    // 다음 페이지 버튼
    html += `
        <button class="page-btn page-arrow" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} aria-label="다음 페이지">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    pagContainer.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderPosts();
    const boardEl = document.getElementById("news");
    if (boardEl) {
        boardEl.scrollIntoView({ behavior: "smooth" });
    }
}

function showBoardEmptyState(message) {
    const listContainer = document.getElementById("board-list");
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="board-empty">
                <i class="far fa-folder-open"></i>
                <p>${message}</p>
            </div>
        `;
    }
    const pagContainer = document.getElementById("board-pagination");
    if (pagContainer) {
        pagContainer.innerHTML = "";
    }
}

/* =========================================================================
   3. 상세 보기 모달
   ========================================================================= */
function openDetailModal(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;

    const modal = document.getElementById("detail-modal");
    const titleEl = document.getElementById("modal-detail-title");
    const metaEl = document.getElementById("modal-detail-meta");
    const contentEl = document.getElementById("modal-detail-content");
    const imageWrap = document.getElementById("modal-detail-image-wrap");
    const actionEl = document.getElementById("modal-detail-admin-actions");

    titleEl.textContent = post.title;
    metaEl.innerHTML = `
        <span class="category-badge ${getCategoryClass(post.category)}">${escapeHtml(post.category || '공지')}</span>
        <span><i class="far fa-calendar-alt"></i> ${formatDate(post.created_at)}</span>
    `;

    // 이미지 표시
    if (post.image_url) {
        imageWrap.style.display = "block";
        imageWrap.innerHTML = `
            <a href="${escapeHtml(post.image_url)}" target="_blank" title="클릭하여 원본 보기">
                <img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title)}">
            </a>
        `;
    } else {
        imageWrap.style.display = "none";
        imageWrap.innerHTML = "";
    }

    // 본문 줄바꿈 보존 렌더링
    contentEl.textContent = post.content;

    // 관리자일 경우 삭제 버튼 표시
    if (currentUser) {
        actionEl.innerHTML = `
            <button class="btn-delete" onclick="deletePost(${post.id}, '${escapeHtml(post.image_url || '')}', true)">
                <i class="fas fa-trash-alt"></i> 이 글 삭제
            </button>
        `;
    } else {
        actionEl.innerHTML = "";
    }

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeDetailModal() {
    const modal = document.getElementById("detail-modal");
    modal.classList.remove("active");
    document.body.style.overflow = "";
}

/* =========================================================================
   4. 관리자 인증 (로그인/로그아웃)
   ========================================================================= */
function updateAdminUI(user) {
    currentUser = user;
    const loginBtn = document.getElementById("btn-admin-login");
    const writeBtn = document.getElementById("btn-admin-write");
    const logoutBtn = document.getElementById("btn-admin-logout");
    const adminBadge = document.getElementById("admin-status-badge");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (writeBtn) writeBtn.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        if (adminBadge) adminBadge.style.display = "inline-flex";
    } else {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (writeBtn) writeBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (adminBadge) adminBadge.style.display = "none";
    }

    // 목록 리렌더링 (삭제 버튼 표시/숨김 갱신)
    if (currentPosts.length > 0) {
        renderPosts();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    if (!sbClient) return alert("Supabase 설정이 완료되지 않았습니다.");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const submitBtn = document.getElementById("btn-submit-login");

    if (!email || !password) {
        alert("이메일과 비밀번호를 모두 입력해주세요.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 로그인 중...';

    try {
        const { data, error } = await sbClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        alert("관리자로 로그인되었습니다.");
        closeLoginModal();
        document.getElementById("form-login").reset();
    } catch (err) {
        console.error("로그인 실패:", err);
        alert("로그인에 실패했습니다: " + (err.message || "계정 정보를 확인해주세요."));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '로그인';
    }
}

async function handleLogout() {
    if (!sbClient) return;
    if (confirm("로그아웃 하시겠습니까?")) {
        await sbClient.auth.signOut();
        alert("로그아웃 되었습니다.");
    }
}

function openLoginModal() {
    document.getElementById("login-modal").classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeLoginModal() {
    document.getElementById("login-modal").classList.remove("active");
    document.body.style.overflow = "";
}

/* =========================================================================
   5. 글쓰기 & 이미지 브라우저 자동 압축 업로드
   ========================================================================= */
function openWriteModal() {
    if (!currentUser) {
        alert("관리자 로그인이 필요합니다.");
        openLoginModal();
        return;
    }
    document.getElementById("write-modal").classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeWriteModal() {
    document.getElementById("write-modal").classList.remove("active");
    document.body.style.overflow = "";
    document.getElementById("form-write").reset();
    resetImagePreview();
}

// 스마트폰 고화질 사진을 웹용으로 브라우저에서 자동 압축 (용량 80% 이상 최적화 및 퀄리티 0.8)
function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        // 이미지가 아닌 경우 그대로 반환
        if (!file || !file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                // 투명 배경 PNG도 자연스럽게 흰 배경으로 채움
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG 80% 화질 압축 (스마트폰 원본 3~10MB -> 200~400KB로 약 80~90% 절감)
                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                        type: "image/jpeg",
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, "image/jpeg", quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

async function handleWriteSubmit(e) {
    e.preventDefault();
    if (!sbClient || !currentUser) {
        alert("관리자 로그인이 필요합니다.");
        return;
    }

    const title = document.getElementById("write-title").value.trim();
    const category = document.getElementById("write-category").value;
    const content = document.getElementById("write-content").value.trim();
    const fileInput = document.getElementById("write-image");
    const submitBtn = document.getElementById("btn-submit-write");

    if (!title || !content) {
        alert("제목과 내용을 입력해주세요.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 및 소식 등록 중...';

    try {
        let imageUrl = null;

        // 이미지 파일이 있는 경우 업로드 (미리 압축된 파일 우선 사용)
        let fileToUpload = preparedImageFile;
        if (!fileToUpload && fileInput.files && fileInput.files[0]) {
            fileToUpload = await compressImage(fileInput.files[0], 1200, 0.8);
        }

        if (fileToUpload) {
            const fileExt = "jpg";
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const filePath = `posts/${fileName}`;

            const { data: uploadData, error: uploadError } = await sbClient.storage
                .from("post-images")
                .upload(filePath, fileToUpload, {
                    cacheControl: "3600",
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 공개 URL 획득
            const { data: urlData } = sbClient.storage
                .from("post-images")
                .getPublicUrl(filePath);

            imageUrl = urlData.publicUrl;
        }

        // DB에 게시글 INSERT
        const { error: insertError } = await sbClient
            .from("posts")
            .insert([{
                title,
                category,
                content,
                image_url: imageUrl,
                created_at: new Date().toISOString()
            }]);

        if (insertError) throw insertError;

        alert("소식이 성공적으로 등록되었습니다!");
        closeWriteModal();
        currentPage = 1;
        fetchPosts(); // 목록 새로고침
    } catch (err) {
        console.error("글 작성 오류:", err);
        alert("글 등록에 실패했습니다: " + (err.message || "오류가 발생했습니다."));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> 등록하기';
    }
}

/* =========================================================================
   6. 게시글 및 이미지 삭제
   ========================================================================= */
async function deletePost(postId, imageUrl, fromModal = false) {
    if (!sbClient || !currentUser) {
        alert("삭제 권한이 없습니다.");
        return;
    }

    if (!confirm("이 게시글을 정말 삭제하시겠습니까?")) return;

    try {
        // 1. 이미지가 있다면 Supabase Storage에서도 삭제
        if (imageUrl && imageUrl.includes("post-images")) {
            try {
                const urlObj = new URL(imageUrl);
                const pathParts = urlObj.pathname.split("/post-images/");
                if (pathParts.length > 1) {
                    const storagePath = decodeURIComponent(pathParts[1]);
                    await sbClient.storage.from("post-images").remove([storagePath]);
                }
            } catch (storageErr) {
                console.warn("스토리지 파일 삭제 건너뜀:", storageErr);
            }
        }

        // 2. DB에서 게시글 삭제
        const { error } = await sbClient
            .from("posts")
            .delete()
            .eq("id", postId);

        if (error) throw error;

        alert("게시글이 삭제되었습니다.");
        if (fromModal) {
            closeDetailModal();
        }
        fetchPosts();
    } catch (err) {
        console.error("삭제 실패:", err);
        alert("삭제 실패: " + err.message);
    }
}

/* =========================================================================
   7. 유틸리티 및 이벤트 등록
   ========================================================================= */
function initBoardEvents() {
    // 탭 카테고리 클릭
    const tabBtns = document.querySelectorAll(".board-tab");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeCategory = btn.getAttribute("data-category");
            currentPage = 1; // 카테고리 변경 시 1페이지로 리셋
            renderPosts();
        });
    });

    // 검색 입력
    const searchInput = document.getElementById("board-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value;
            currentPage = 1; // 검색어 입력 시 1페이지로 리셋
            renderPosts();
        });
    }

    // 모달 닫기 배경 클릭
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("active");
                document.body.style.overflow = "";
            }
        });
    });

    // 이미지 첨부 시 압축 및 미리보기
    const imageInput = document.getElementById("write-image");
    if (imageInput) {
        imageInput.addEventListener("change", handleImagePreview);
    }
}

async function handleImagePreview(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("image-preview");
    const infoEl = document.getElementById("image-compression-info");

    if (file) {
        if (infoEl) {
            infoEl.style.display = "block";
            infoEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 이미지 압축 및 용량 최적화 중...`;
        }

        try {
            // 브라우저 캔버스를 통해 1200px 리사이징 & 80% 화질로 압축 (용량 80% 이상 절감)
            const compressed = await compressImage(file, 1200, 0.8);
            preparedImageFile = compressed;

            const origKb = Math.round(file.size / 1024);
            const compKb = Math.round(compressed.size / 1024);
            const savedPercent = Math.max(0, Math.round(((file.size - compressed.size) / file.size) * 100));

            const origText = origKb >= 1024 ? `${(origKb / 1024).toFixed(1)}MB` : `${origKb}KB`;
            const compText = compKb >= 1024 ? `${(compKb / 1024).toFixed(1)}MB` : `${compKb}KB`;

            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewContainer.style.display = "block";
            };
            reader.readAsDataURL(compressed);

            if (infoEl) {
                infoEl.innerHTML = `
                    <i class="fas fa-check-circle"></i> <strong>이미지 용량 약 ${savedPercent}% 절감 완료:</strong> 
                    ${origText} ➔ <strong>${compText}</strong>
                `;
            }
        } catch (err) {
            console.error("이미지 압축 오류:", err);
            preparedImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                previewContainer.style.display = "block";
            };
            reader.readAsDataURL(file);

            if (infoEl) {
                infoEl.innerHTML = `<i class="fas fa-info-circle"></i> 원본 사진으로 등록됩니다.`;
            }
        }
    } else {
        resetImagePreview();
    }
}

function resetImagePreview() {
    preparedImageFile = null;
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("image-preview");
    const imageInput = document.getElementById("write-image");
    const infoEl = document.getElementById("image-compression-info");

    if (previewContainer) previewContainer.style.display = "none";
    if (previewImg) previewImg.src = "";
    if (imageInput) imageInput.value = "";
    if (infoEl) {
        infoEl.style.display = "none";
        infoEl.innerHTML = "";
    }
}

function formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
}

function getCategoryClass(cat) {
    switch (cat) {
        case "주보": return "cat-bulletin";
        case "공지": return "cat-notice";
        case "행사": return "cat-event";
        default: return "cat-general";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
