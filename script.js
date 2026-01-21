document.addEventListener("DOMContentLoaded", () => {
    const loading = document.getElementById("loading");
    if (!loading) return;

    const isMobile = window.innerWidth <= 768;

    const MIN_LOADING_TIME = isMobile ? 400 : 900;
    const FADE_OUT_TIME = 600;

    const todayKey = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem("loadingLastShown");

    const shouldShowLoading = lastShown !== todayKey;

    function revealHeroContents() {
        const heroReveals = document.querySelectorAll(
            "#home .reveal"
        );

        heroReveals.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add("active");
            }, i * 180);
        });
    }

    if (shouldShowLoading) {
        localStorage.setItem("loadingLastShown", todayKey);

        setTimeout(() => {
            loading.classList.add("hide");

            setTimeout(() => {
                loading.remove();
                revealHeroContents(); // ⭐ 로딩 종료 후 hero 등장
            }, FADE_OUT_TIME);

        }, MIN_LOADING_TIME);

    } else {
        loading.remove();
        revealHeroContents();
    }
});

document.addEventListener("DOMContentLoaded", () => {

    const header = document.querySelector("header");
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll("header nav a");
    const nav = document.querySelector("header nav");
    const toggle = document.querySelector(".menu-toggle");
    const reveals = document.querySelectorAll(".reveal");

    function onScroll() {

        /* 헤더 */
        if (header) {
            header.classList.toggle("scrolled", window.scrollY > 30);
        }

        /* 현재 섹션 */
        let current = "";
        sections.forEach(sec => {
            if (window.scrollY >= sec.offsetTop - 140) {
                current = sec.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.getAttribute("href") === `#${current}`
            );
        });

        /* 🔥 reveal 핵심 */
        reveals.forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 100) {
                el.classList.add("active");
            }
        });
    }

    /* 스크롤 이벤트 */
    window.addEventListener("scroll", onScroll);

    /* ⭐⭐⭐ 페이지 로드 시 한 번 강제 실행 */
    onScroll();

    /* 햄버거 */
    if (toggle && nav) {
        toggle.addEventListener("click", () => nav.classList.toggle("open"));
    }
});

/* ===== SEASONAL VERSES ===== */
function getSeasonVerses() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 부활절 계산 (서방교회 기준)
    function getEaster(year) {
        const f = Math.floor;
        const G = year % 19;
        const C = f(year / 100);
        const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
        const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
        const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
        const L = I - J;
        const month = 3 + f((L + 40) / 44);
        const day = L + 28 - 31 * f(month / 4);
        return new Date(year, month - 1, day);
    }

    const easter = getEaster(now.getFullYear());
    const diff = (now - easter) / (1000 * 60 * 60 * 24);

    // 🎄 대림절
    if (month === 12 && day <= 24) {
        return [
            "“보라 처녀가 잉태하여 아들을 낳을 것이요.” — 이사야 7:14",
            "“어둠에 행하던 백성이 큰 빛을 보았도다.” — 이사야 9:2"
        ];
    }

    // ✝️ 부활절 주간
    if (diff >= 0 && diff <= 7) {
        return [
            "“그가 살아나셨고 여기 계시지 아니하니라.” — 마가복음 16:6",
            "“나는 부활이요 생명이니.” — 요한복음 11:25"
        ];
    }

    // 기본
    return [
        "“하나님을 기뻐하라.” — 시편 37:4",
        "“서로 사랑하라.” — 요한복음 13:34",
        "“하나님이 이 세상을 위해 아들을 주셨으니, 그를 믿는 자는 죽지 않고 영생을 얻으리라.” — 요한복음 3:16",
        "“두 사람이 동행하려면 뜻이 같아야 하지 아니하겠느냐.” — 아모스 3:3",
        "“너희는 세상의 소금이라.” — 마태복음 5:13",
        "“너희는 세상의 빛이라.” — 마태복음 5:14",
        "“내가 곧 길이요 진리요 생명이니.” — 요한복음 14:6",
        "“내게로 오라.” — 마태복음 11:28",
        "“내가 너희를 사랑한 것 같이 너희도 서로 사랑하라.” — 요한복음 15:12",
        "“너희는 마음을 다하고 뜻을 다하고 힘을 다하여 주 너희 하나님을 사랑하라.” — 신명기 6:5",
        "“너희는 먼저 그의 나라와 그의 의를 구하라.” — 마태복음 6:33",
        "“내가 세상 끝날까지 너희와 항상 함께 있으리라.” — 마태복음 28:20",
        "“내가 너희를 친구라 부르노라.” — 요한복음 15:15",
        "“내 평안을 너희에게 주노라.” — 요한복음 14:27",
        "“내가 약한 그 때에 강함이 되느니라.” — 고린도후서 12:9",
        "“너희는 하나님의 성전이라.” — 고린도전서 3:16",
        "“내가 너희를 택하여 세웠나니.” — 요한복음 15:16",
        "“내가 너희를 세상에 보내노라.” — 요한복음 17:18",
        "“내가 너희를 사랑하였으니 너희도 서로 사랑하라.” — 요한일서 4:11"
    ];
}

/* verse DOM 교체 */
(() => {
    const slider = document.querySelector(".verse-slider");
    if (!slider) return;

    const verses = getSeasonVerses();
    slider.innerHTML = "";

    verses.forEach((text, i) => {
        const div = document.createElement("div");
        div.className = "verse" + (i === 0 ? " active" : "");
        div.innerHTML = text.replace("—", "<span>—");
        slider.appendChild(div);
    });
})();

/* ===== HERO VERSE SLIDE ===== */
(() => {
    const verses = document.querySelectorAll(".verse");
    if (verses.length === 0) return;

    let index = 0;

    setInterval(() => {
        verses[index].classList.remove("active");
        index = (index + 1) % verses.length;
        verses[index].classList.add("active");
    }, 5000);
})();

/* ===== WORSHIP DAY AUTO HIGHLIGHT ===== */
(() => {
    const today = new Date().getDay(); // 0=일, 3=수
    const days = document.querySelectorAll(".worship-day");

    days.forEach(day => {
        if (
            (today === 0 && day.dataset.day === "sun") ||
            (today === 3 && day.dataset.day === "wed")
        ) {
            day.classList.add("active");
        }
    });
})();

/* ===== LIVE BUTTON AUTO HIGHLIGHT ===== */
(() => {
    const liveBtn = document.querySelector(".live-button");
    if (!liveBtn) return;

    const now = new Date();
    const day = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let targetMinutes = null;

    // 수요일
    if (day === 3) targetMinutes = 20 * 60;
    // 주일
    if (day === 0) targetMinutes = 11 * 60;

    if (!targetMinutes) return;

    if (currentMinutes >= targetMinutes - 30 && currentMinutes <= targetMinutes + 10) {
        liveBtn.classList.add("highlight");
    }
})();

(() => {
    const liveBtn = document.querySelector(".live-button");
    const liveText = document.querySelector(".live-text");
    if (!liveBtn || !liveText) return;

    const now = new Date();
    const day = now.getDay(); // 0=일, 3=수
    const current = now.getHours() * 60 + now.getMinutes();

    let serviceTime = null;

    // 예배 시간 설정
    if (day === 0) serviceTime = 11 * 60; // 주일 11:00
    if (day === 3) serviceTime = 20 * 60; // 수요 20:00

    if (!serviceTime) return;

    /* 예배 10분 전 → 말 걸기 */
    if (current >= serviceTime - 10 && current < serviceTime) {
        liveBtn.classList.add("highlight", "talk");
    }

    /* 예배 시작 ~ 90분 */
    if (current >= serviceTime && current <= serviceTime + 90) {
        liveBtn.classList.add("highlight", "onair");
        liveBtn.classList.remove("talk");
        liveText.textContent = "지금 LIVE 중";
    }

    /* 예배 종료 후 */
    if (current > serviceTime + 90) {
        liveBtn.classList.add("hide");
    }

})();

/* ===== NOTICE FETCHING ===== */
document.addEventListener("DOMContentLoaded", () => {
    const noticeBox = document.querySelector(".notice-box");
    if (!noticeBox) return;

    fetch("notices.json")
        .then(response => {
            if (!response.ok) throw new Error("네트워크 응답 실패");
            return response.json();
        })
        .then(data => {
            // 기존 내용(주석 등) 비우기
            noticeBox.innerHTML = "";

            if (data.length === 0) {
                noticeBox.innerHTML = "<p class='no-notice'>등록된 공지사항이 없습니다.</p>";
                return;
            }

            data.forEach(notice => {
                const item = document.createElement("div");
                item.className = "notice-item";

                // 중요 공지 스타일
                if (notice.important) {
                    item.classList.add("pinned", "important");
                    // 배지 추가
                    const badge = document.createElement("span");
                    badge.className = "notice-badge";
                    badge.innerHTML = '<i class="fas fa-thumbtack"></i>'; // 📌 핀 아이콘
                    item.appendChild(badge);
                }

                // 날짜
                const dateSpan = document.createElement("span");
                dateSpan.className = "notice-date";
                dateSpan.textContent = notice.date;
                item.appendChild(dateSpan);

                // 제목
                const titleStrong = document.createElement("strong");
                titleStrong.textContent = notice.title;
                item.appendChild(titleStrong);

                // 내용
                const contentP = document.createElement("p");
                contentP.textContent = notice.content;
                item.appendChild(contentP);

                noticeBox.appendChild(item);
            });
        })
        .catch(error => {
            console.error("공지사항 로딩 실패:", error);
            noticeBox.innerHTML = "<p class='error-notice'>공지사항을 불러오는 데 실패했습니다.</p>";
        });
});
