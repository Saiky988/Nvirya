/* =============================================
   NVIRYA — Main Script
   NVR://SYSTEM v001
   ============================================= */

'use strict';

/* =============================================
   PROJECT DATA
   ============================================= */
const projects = [
    {
        number: "01",
        name: "Elyriax",
        category: "Infrastructure",
        description: "Digital infrastructure for independent systems. A foundation layer designed to evolve.",
        status: "ACTIVE",
        statusClass: "active",
        url: "https://elyriax.com"
    },
    {
        number: "02",
        name: "Nvirya Compiler",
        category: "Developer Tooling",
        description: "Internal toolchain for building and composing Nvirya-ecosystem projects with precision.",
        status: "BUILDING",
        statusClass: "building",
        url: "#"
    },
    {
        number: "03",
        name: "Obscura",
        category: "Developer Utility",
        description: "A minimal utility set for developers who want clean primitives over heavy abstraction.",
        status: "BUILDING",
        statusClass: "building",
        url: "#"
    },
    {
        number: "04",
        name: "YoxTube",
        category: "Media / Automation",
        description: "Automated media tooling. Early-stage exploration in content and audio processing.",
        status: "CONCEPT",
        statusClass: "concept",
        url: "https://yoxtube.xyz"
    }
];

/* =============================================
   RENDER PROJECTS
   ============================================= */
function renderProjects() {
    const container = document.getElementById('project-list');
    if (!container) return;

    const html = projects.map((p, i) => `
        <a
            href="${p.url}"
            class="project-item reveal reveal-delay-${Math.min(i + 1, 4)}"
            aria-label="View project ${p.name}"
        >
            <span class="project-number mono">${p.number}</span>
            <div class="project-info">
                <span class="project-name">${p.name}</span>
                <span class="project-description">${p.description}</span>
                <div class="project-tags">
                    <span class="project-tag">${p.category}</span>
                    <span class="project-status ${p.statusClass}">${p.status}</span>
                </div>
            </div>
            <div class="project-right">
                <span class="project-arrow" aria-hidden="true">↗</span>
            </div>
        </a>
    `).join('');

    container.innerHTML = html;

    // Update project count
    const countEl = document.getElementById('project-count');
    if (countEl) {
        countEl.textContent = `${String(projects.length).padStart(2, '0')} Projects`;
    }
}

/* =============================================
   NAVIGATION
   ============================================= */
function initNav() {
    const nav = document.getElementById('nav');
    const hamburger = document.getElementById('nav-hamburger');
    const overlay = document.getElementById('nav-mobile-overlay');
    const mobileLinks = overlay ? overlay.querySelectorAll('a') : [];

    // Scroll handler — add scrolled class
    let ticking = false;
    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (nav) {
                    nav.classList.toggle('scrolled', window.scrollY > 20);
                }
                updateActiveNav();
                ticking = false;
            });
            ticking = true;
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // Hamburger toggle
    if (hamburger && overlay) {
        hamburger.addEventListener('click', () => {
            const isOpen = hamburger.classList.toggle('open');
            overlay.classList.toggle('open', isOpen);
            hamburger.setAttribute('aria-expanded', String(isOpen));
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close on mobile link click
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('open');
                overlay.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });
    }

    // Close on overlay background click
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hamburger.classList.remove('open');
                overlay.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            }
        });
    }

    // Keyboard: close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
            hamburger.classList.remove('open');
            overlay.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    });
}

/* =============================================
   ACTIVE NAVIGATION HIGHLIGHT
   ============================================= */
function updateActiveNav() {
    const sections = document.querySelectorAll('section[id], div[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    const scrollY = window.scrollY + 120;

    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        if (scrollY >= top && scrollY < top + height) {
            current = section.id;
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

/* =============================================
   SMOOTH SCROLL
   ============================================= */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const navHeight = parseInt(getComputedStyle(document.documentElement)
                    .getPropertyValue('--nav-height')) || 64;
                const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

/* =============================================
   SCROLL REVEAL (IntersectionObserver)
   ============================================= */
function initReveal() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hero elements trigger on load
    requestAnimationFrame(() => {
        document.querySelectorAll('.hero-title .line-inner').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), 100 + i * 80);
        });
        setTimeout(() => {
            const subtitle = document.querySelector('.hero-subtitle');
            if (subtitle) subtitle.classList.add('visible');
        }, 480);
        setTimeout(() => {
            const actions = document.querySelector('.hero-actions');
            if (actions) actions.classList.add('visible');
        }, 640);
        setTimeout(() => {
            const bottom = document.querySelector('.hero-bottom');
            if (bottom) bottom.classList.add('visible');
        }, 900);
    });

    if (prefersReduced) {
        // Skip reveal animation, just show everything
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

/* =============================================
   YEAR AUTO-UPDATE
   ============================================= */
function updateYear() {
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
    renderProjects();
    initNav();
    initSmoothScroll();
    updateYear();

    // Reveal must run after renderProjects (which adds .reveal elements to DOM)
    requestAnimationFrame(() => {
        initReveal();
    });
});

