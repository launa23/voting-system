/**
 * BrightVote - Candidate Detail Page
 * JavaScript for candidate detail functionality
 */

// Candidate data (same as main page for consistency)
const candidates = [
    {
        id: 1,
        name: "Nguyễn Thị Hương",
        shortDescription: "Chuyên gia phát triển cộng đồng, tích cực tham gia các hoạt động xã hội.",
        fullDescription: [
            "Nguyễn Thị Hương là một nhà lãnh đạo cộng đồng đầy nhiệt huyết, người đã dành hơn 15 năm cống hiến cho sự phát triển của thành phố. Với bằng Thạc sĩ Quản lý Công và kinh nghiệm làm việc sâu rộng trong các tổ chức phi lợi nhuận, cô Hương đã khởi xướng nhiều dự án thành công nhằm cải thiện chất lượng giáo dục, nâng cao y tế cộng đồng và thúc đẩy phát triển kinh tế bền vững.",
            "Cô Hương tin rằng một cộng đồng mạnh mẽ được xây dựng dựa trên sự hợp tác, minh bạch và sự tham gia của mọi người dân. Cô cam kết lắng nghe ý kiến của cử tri, giải quyết các vấn đề cấp bách nhất và mang lại một tương lai tươi sáng hơn cho tất cả mọi người. Chương trình hành động của cô tập trung vào việc đầu tư vào cơ sở hạ tầng xanh, hỗ trợ các doanh nghiệp nhỏ và vừa, và đảm bảo mọi trẻ em đều có cơ hội tiếp cận nền giáo dục chất lượng cao.",
            "Hãy cùng Nguyễn Thị Hương xây dựng một cộng đồng đoàn kết, thịnh vượng và công bằng!"
        ],
        votes: 154897,
        category: "xahoi",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=450&fit=crop&crop=face"
    },
    {
        id: 2,
        name: "Lê Văn Khang",
        shortDescription: "Doanh nhân thành đạt với tầm nhìn phát triển kinh tế địa phương.",
        fullDescription: [
            "Lê Văn Khang là một doanh nhân có tầm nhìn xa, người đã xây dựng nhiều doanh nghiệp thành công và tạo ra hàng nghìn việc làm cho người dân địa phương.",
            "Với kinh nghiệm quản lý và lãnh đạo xuất sắc, ông Khang cam kết mang đến những chính sách hỗ trợ doanh nghiệp vừa và nhỏ, thúc đẩy khởi nghiệp và phát triển kinh tế bền vững.",
            "Hãy cùng Lê Văn Khang xây dựng một nền kinh tế vững mạnh và thịnh vượng!"
        ],
        votes: 128450,
        category: "kinhte",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=450&fit=crop&crop=face"
    },
    {
        id: 3,
        name: "Trần Minh Tâm",
        shortDescription: "Nhà khoa học trẻ với đam mê nghiên cứu và đổi mới công nghệ.",
        fullDescription: [
            "Trần Minh Tâm là một nhà khoa học trẻ tài năng, người đã có nhiều công trình nghiên cứu được công nhận trong và ngoài nước.",
            "Với niềm đam mê công nghệ và đổi mới sáng tạo, anh Tâm mong muốn ứng dụng khoa học công nghệ để giải quyết các vấn đề môi trường và nâng cao chất lượng cuộc sống.",
            "Hãy cùng Trần Minh Tâm hướng tới một tương lai xanh và bền vững!"
        ],
        votes: 95200,
        category: "moitruong",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=450&fit=crop&crop=face"
    },
    {
        id: 4,
        name: "Phạm Thu Thảo",
        shortDescription: "Giáo viên tận tâm với sứ mệnh nâng cao chất lượng giáo dục.",
        fullDescription: [
            "Phạm Thu Thảo là một giáo viên với hơn 20 năm kinh nghiệm trong ngành giáo dục, người đã đào tạo hàng nghìn học sinh thành tài.",
            "Với niềm tin vào sức mạnh của giáo dục, cô Thảo cam kết đấu tranh cho quyền được học tập của mọi trẻ em và nâng cao chất lượng đào tạo tại các trường học.",
            "Hãy cùng Phạm Thu Thảo xây dựng một nền giáo dục công bằng và chất lượng!"
        ],
        votes: 112300,
        category: "xahoi",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=450&fit=crop&crop=face"
    },
    {
        id: 5,
        name: "Hoàng Quốc Việt",
        shortDescription: "Luật sư bảo vệ quyền lợi người dân và đấu tranh cho công bằng xã hội.",
        fullDescription: [
            "Hoàng Quốc Việt là một luật sư dày dặn kinh nghiệm, người đã dành cả sự nghiệp để bảo vệ quyền lợi của những người yếu thế trong xã hội.",
            "Với tinh thần công bằng và chính nghĩa, ông Việt cam kết xây dựng một xã hội mà mọi người đều được đối xử bình đẳng trước pháp luật.",
            "Hãy cùng Hoàng Quốc Việt xây dựng một xã hội công bằng và văn minh!"
        ],
        votes: 89700,
        category: "chinhtri",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=450&fit=crop&crop=face"
    }
];

// DOM elements
const candidateDetail = document.getElementById('candidateDetail');
const otherCandidates = document.getElementById('otherCandidates');
const voteModal = document.getElementById('voteModal');
const votedCandidateSpan = document.getElementById('votedCandidate');

/**
 * Get candidate ID from URL parameter
 * @returns {number|null} Candidate ID or null if not found
 */
function getCandidateIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    return id ? parseInt(id, 10) : null;
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
 * Render candidate detail
 * @param {Object} candidate - Candidate data object
 */
function renderCandidateDetail(candidate) {
    const bioParagraphs = candidate.fullDescription.map(p => `<p>${p}</p>`).join('');

    candidateDetail.innerHTML = `
        <div class="candidate-image-wrapper">
            <img 
                src="${candidate.avatar}" 
                alt="${candidate.name}" 
                class="candidate-image"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22450%22><rect fill=%22%23e5e7eb%22 width=%22600%22 height=%22450%22/><text fill=%22%239ca3af%22 font-size=%2280%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>${candidate.name.charAt(0)}</text></svg>'"
            >
        </div>
        
        <h1 class="candidate-detail-name">${candidate.name}</h1>
        
        <div class="candidate-detail-votes">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>${formatNumber(candidate.votes)} Phiếu</span>
        </div>
        
        <div class="candidate-bio">
            ${bioParagraphs}
        </div>
        
        <p class="candidate-cta">Hãy cùng ${candidate.name} xây dựng một cộng đồng đoàn kết, thịnh vượng và công bằng!</p>
        
        <button class="vote-btn-large" onclick="handleVote(${candidate.id})">
            Bình chọn cho ${candidate.name}
        </button>
    `;

    // Update page title
    document.title = `${candidate.name} - BrightVote`;
}

/**
 * Render other candidates in sidebar
 * @param {number} currentId - Current candidate ID to exclude
 */
function renderOtherCandidates(currentId) {
    const others = candidates.filter(c => c.id !== currentId).slice(0, 4);

    otherCandidates.innerHTML = others.map(candidate => `
        <a href="candidate-detail.html?id=${candidate.id}" class="other-candidate-item">
            <img 
                src="${candidate.avatar.replace('600', '150').replace('450', '150')}" 
                alt="${candidate.name}" 
                class="other-candidate-avatar"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/><text fill=%22%239ca3af%22 font-size=%2240%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>${candidate.name.charAt(0)}</text></svg>'"
            >
            <span class="other-candidate-name">${candidate.name}</span>
        </a>
    `).join('');
}

/**
 * Handle vote button click
 * @param {number} candidateId - ID of the candidate to vote for
 */
function handleVote(candidateId) {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
        // Increment vote count
        candidate.votes += 1;

        // Update UI
        renderCandidateDetail(candidate);

        // Show success modal
        votedCandidateSpan.textContent = candidate.name;
        voteModal.classList.add('active');

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
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
 * Show not found message
 */
function showNotFound() {
    candidateDetail.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem; opacity: 0.5;">
                <path d="M12 9v4m0 4h.01M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h2 style="color: var(--gray-700); margin-bottom: 0.5rem;">Không tìm thấy ứng cử viên</h2>
            <p style="color: var(--gray-500); margin-bottom: 1.5rem;">Ứng cử viên bạn đang tìm không tồn tại.</p>
            <a href="../index.html" class="btn btn-primary">Quay lại trang chủ</a>
        </div>
    `;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const candidateId = getCandidateIdFromUrl();

    if (candidateId) {
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
            renderCandidateDetail(candidate);
            renderOtherCandidates(candidateId);
        } else {
            showNotFound();
            renderOtherCandidates(0);
        }
    } else {
        // Default to first candidate if no ID provided
        renderCandidateDetail(candidates[0]);
        renderOtherCandidates(candidates[0].id);
    }

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

// Expose functions to global scope
window.closeModal = closeModal;
window.handleVote = handleVote;
