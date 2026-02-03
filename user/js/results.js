/**
 * BrightVote - Election Results Page
 * JavaScript for displaying voting results and rankings
 */

// Candidate data with voting results
const candidates = [
    {
        id: 1,
        name: "Mai Hoa",
        description: "Kinh tế gia với tầm nhìn vì một tương lai bền vững.",
        votes: 25789,
        category: "kinhte",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: 2,
        name: "Trần Anh",
        description: "Nhà hoạt động xã hội, đấu tranh vì công bằng cộng đồng.",
        votes: 21345,
        category: "xahoi",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: 3,
        name: "Lê Thị Lan",
        description: "Luật sư, bảo vệ quyền lợi hợp pháp của mọi người.",
        votes: 18900,
        category: "chinhtri",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: 4,
        name: "Phạm Văn Long",
        description: "Giáo sư, chuyên gia về công nghệ thông tin.",
        votes: 15678,
        category: "congnghe",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: 5,
        name: "Nguyễn Thu Thủy",
        description: "Nghệ sĩ, mang lại giá trị văn hóa cho cộng đồng.",
        votes: 12345,
        category: "giaitri",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"
    },
    {
        id: 6,
        name: "Hoàng Minh",
        description: "Chuyên gia công nghệ, tiên phong trong đổi mới.",
        votes: 9876,
        category: "congnghe",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face"
    }
];

// DOM elements
const rankingsList = document.getElementById('rankingsList');
const totalVotesEl = document.getElementById('totalVotes');
const topCandidateEl = document.getElementById('topCandidate');
const participationRateEl = document.getElementById('participationRate');
const timeFilters = document.getElementById('timeFilters');
const categoryFilters = document.getElementById('categoryFilters');

// Current filter state
let currentTimeFilter = 'today';
let currentCategoryFilter = 'all';

/**
 * Format number with comma separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

/**
 * Calculate and update statistics
 * @param {Array} filteredCandidates - Filtered candidate array
 */
function updateStats(filteredCandidates) {
    const totalVotes = filteredCandidates.reduce((sum, c) => sum + c.votes, 0);
    const topCandidate = filteredCandidates.length > 0 ? filteredCandidates[0] : null;

    // Calculate participation rate (simulated - based on hypothetical voter base)
    const voterBase = 191000; // Hypothetical total eligible voters
    const participationRate = ((totalVotes / voterBase) * 100).toFixed(1);

    totalVotesEl.textContent = formatNumber(totalVotes);
    topCandidateEl.textContent = topCandidate ? topCandidate.name : '-';
    participationRateEl.textContent = participationRate + '%';
}

/**
 * Create ranking item HTML
 * @param {Object} candidate - Candidate data object
 * @param {number} rank - Rank position
 * @returns {string} HTML string for ranking item
 */
function createRankingItem(candidate, rank) {
    return `
        <div class="ranking-item" data-rank="${rank}">
            <span class="ranking-position">${rank}.</span>
            <img 
                src="${candidate.avatar}" 
                alt="${candidate.name}" 
                class="ranking-avatar"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/><text fill=%22%239ca3af%22 font-size=%2240%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>${candidate.name.charAt(0)}</text></svg>'"
            >
            <div class="ranking-info">
                <div class="ranking-name">${candidate.name}</div>
                <div class="ranking-description">${candidate.description}</div>
            </div>
            <div class="ranking-votes">${formatNumber(candidate.votes)}</div>
        </div>
    `;
}

/**
 * Render rankings based on current filters
 */
function renderRankings() {
    let filteredCandidates = [...candidates];

    // Apply category filter
    if (currentCategoryFilter !== 'all') {
        filteredCandidates = filteredCandidates.filter(c => c.category === currentCategoryFilter);
    }

    // Apply time filter (simulated - just show different subsets)
    if (currentTimeFilter === 'today') {
        // Show all for demo
    } else if (currentTimeFilter === 'week') {
        // Slightly different votes for demo
        filteredCandidates = filteredCandidates.map(c => ({
            ...c,
            votes: Math.round(c.votes * 1.2)
        }));
    } else if (currentTimeFilter === 'month') {
        filteredCandidates = filteredCandidates.map(c => ({
            ...c,
            votes: Math.round(c.votes * 2.5)
        }));
    } else if (currentTimeFilter === 'all') {
        filteredCandidates = filteredCandidates.map(c => ({
            ...c,
            votes: Math.round(c.votes * 4)
        }));
    }

    // Sort by votes descending
    filteredCandidates.sort((a, b) => b.votes - a.votes);

    // Update stats
    updateStats(filteredCandidates);

    // Render list
    if (filteredCandidates.length === 0) {
        rankingsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                <p>Không có dữ liệu cho bộ lọc này.</p>
            </div>
        `;
    } else {
        rankingsList.innerHTML = filteredCandidates
            .map((candidate, index) => createRankingItem(candidate, index + 1))
            .join('');
    }
}

/**
 * Handle time filter click
 * @param {Event} event - Click event
 */
function handleTimeFilterClick(event) {
    const btn = event.target;
    if (btn.classList.contains('filter-btn')) {
        timeFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTimeFilter = btn.dataset.filter;
        renderRankings();
    }
}

/**
 * Handle category filter click
 * @param {Event} event - Click event
 */
function handleCategoryFilterClick(event) {
    const btn = event.target;
    if (btn.classList.contains('filter-btn')) {
        categoryFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategoryFilter = btn.dataset.filter;
        renderRankings();
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Initial render
    renderRankings();

    // Filter event listeners
    timeFilters.addEventListener('click', handleTimeFilterClick);
    categoryFilters.addEventListener('click', handleCategoryFilterClick);
});
