/**
 * BrightVote - Voting System
 * Main JavaScript file for candidate voting functionality
 */

// API Configuration
const API_ENDPOINT = 'https://f8rpo1hjn2.execute-api.ap-southeast-1.amazonaws.com'; // Thay bằng API endpoint của bạn
const CLOUDFRONT_URL = 'https://d3vvv7egqrgahj.cloudfront.net/candidates.json'; // Thay bằng CloudFront URL của bạn
const API_TOKEN = 'Bearer SUPER_SECRET_MASTER_KEY_2026';

// State
let candidates = [];
let currentUserId = localStorage.getItem('userId') || '';

// DOM elements
const candidatesGrid = document.getElementById('candidatesGrid');
const searchInput = document.getElementById('searchInput');
const voteModal = document.getElementById('voteModal');
const votedCandidateSpan = document.getElementById('votedCandidate');

// Current search state
let searchTerm = '';

/**
 * Load candidates from API
 */
async function loadCandidates() {
    try {
        candidatesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--gray-500);">
                <div style="width: 48px; height: 48px; border: 4px solid var(--gray-200); border-top-color: var(--primary-500); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div>
                <p style="font-size: 1.125rem; font-weight: 500;">Đang tải danh sách ứng viên...</p>
            </div>
        `;

        const response = await fetch(`${CLOUDFRONT_URL}`);
        
        if (!response.ok) {
            throw new Error('Không thể tải danh sách ứng viên');
        }

        const data = await response.json();
        candidates = data.candidates || [];
        
        // Map data to match existing structure
        candidates = candidates.map(c => ({
            id: c.CandidateId,
            name: c.Name,
            description: c.Description || 'Ứng viên tham gia bầu cử',
            votes: c.votes || 0,
            avatar: c.ImageUrl || null,
            category: 'xahoi' // Default category
        }));

        renderCandidates();
    } catch (error) {
        console.error('Error loading candidates:', error);
        candidatesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--red-500);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem; opacity: 0.5; stroke: currentColor;">
                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                    <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p style="font-size: 1.125rem; font-weight: 500;">Lỗi khi tải dữ liệu</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</p>
                <button onclick="loadCandidates()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-500); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Thử lại</button>
            </div>
        `;
    }
}

/**
 * Format number with comma separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

/**
 * Create candidate card HTML
 * @param {Object} candidate - Candidate data object
 * @returns {string} HTML string for candidate card
 */
function createCandidateCard(candidate) {
    const avatarUrl = candidate.avatar || `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%23e5e7eb' width='100' height='100'/><text fill='%239ca3af' font-size='40' x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>${candidate.name.charAt(0)}</text></svg>`;
    
    return `
        <article class="candidate-card" data-category="${candidate.category}" data-id="${candidate.id}">
            <a href="pages/candidate-detail.html?id=${candidate.id}" class="candidate-link">
                <img 
                    src="${avatarUrl}" 
                    alt="${candidate.name}" 
                    class="candidate-avatar"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/><text fill=%22%239ca3af%22 font-size=%2240%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>${candidate.name.charAt(0)}</text></svg>'"
                >
            </a>
            <a href="pages/candidate-detail.html?id=${candidate.id}" class="candidate-name-link">
                <h3 class="candidate-name">${candidate.name}</h3>
            </a>
            <p class="candidate-description">${candidate.description}</p>
            <div class="candidate-votes">
                <svg class="vote-star" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${formatNumber(candidate.votes)} phiếu</span>
            </div>
            <button class="vote-btn" onclick="handleVote('${candidate.id}')">
                Bỏ phiếu
            </button>
        </article>
    `;
}

/**
 * Render candidates based on search term
 */
function renderCandidates() {
    const filteredCandidates = candidates.filter(candidate => {
        const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            candidate.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (filteredCandidates.length === 0) {
        candidatesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--gray-500);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem; opacity: 0.5;">
                    <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p style="font-size: 1.125rem; font-weight: 500;">Không tìm thấy ứng cử viên</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Thử tìm kiếm với từ khóa khác</p>
            </div>
        `;
    } else {
        candidatesGrid.innerHTML = filteredCandidates.map(createCandidateCard).join('');
    }
}

/**
 * Handle vote button click
 * @param {string} candidateId - ID of the candidate to vote for
 */
async function handleVote(candidateId) {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    // Prompt for User ID if not set
    // Check if user is logged in
    const idToken = localStorage.getItem('idToken');
    const accessToken = localStorage.getItem('accessToken');
    
    if (!idToken || !accessToken) {
        alert('Vui lòng đăng nhập để bỏ phiếu!');
        window.location.href = 'auth.html';
        return;
    }

    // Get userId from localStorage or fetch from API
    let userId = localStorage.getItem('userId');
    
    if (!userId) {
        try {
            const userResponse = await fetch(`${API_ENDPOINT}/user/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                userId = userData.userId;
                localStorage.setItem('userId', userId);
                localStorage.setItem('userName', userData.name || userData.email);
            } else {
                alert('Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.');
                window.location.href = 'auth.html';
                return;
            }
        } catch (err) {
            console.error('Error fetching user info:', err);
            alert('Lỗi khi lấy thông tin người dùng.');
            return;
        }
    }

    // Confirm vote
    if (!confirm(`Bạn có chắc muốn bỏ phiếu cho ${candidate.name}?\n\nLưu ý: Mỗi User ID chỉ được vote 1 lần!`)) {
        return;
    }

    try {
        const response = await fetch(`${API_ENDPOINT}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                userId: userId,
                candidateId: candidateId
            })
        });

        if (response.ok) {
            // Update local vote count
            candidate.votes += 1;

            // Update UI
            renderCandidates();

            // Show success modal
            votedCandidateSpan.textContent = candidate.name;
            voteModal.classList.add('active');

            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            const data = await response.json();
            
            if (response.status === 401) {
                alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
                localStorage.removeItem('idToken');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = 'auth.html';
            } else if (response.status === 403) {
                alert('Bạn đã bỏ phiếu rồi! Mỗi người chỉ được vote 1 lần.');
            } else {
                alert('Lỗi khi bỏ phiếu: ' + (data.error || 'Vui lòng thử lại'));
            }
        }
    } catch (error) {
        console.error('Error voting:', error);
        alert('Lỗi kết nối: ' + error.message);
    }
}

/**
 * Close the vote modal
 */
function closeModal() {
    voteModal.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Handle search input
 * @param {Event} event - Input event
 */
function handleSearch(event) {
    searchTerm = event.target.value;
    renderCandidates();
}

/**
 * Debounce function for search optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load candidates from API
    loadCandidates();

    // Search input with debounce
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Close modal on overlay click
    voteModal.addEventListener('click', (event) => {
        if (event.target === voteModal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && voteModal.classList.contains('active')) {
            closeModal();
        }
    });
});

// Expose functions to global scope for inline onclick
window.closeModal = closeModal;
window.handleVote = handleVote;
window.loadCandidates = loadCandidates;
