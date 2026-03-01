import { supabase } from './supabase.js';

async function loadAds(filters = {}) {
    const container = document.querySelector('.col-lg-9');
    // Keep header, remove old list
    const header = container.querySelector('.d-flex');
    container.innerHTML = '';
    if(header) container.appendChild(header);

    container.innerHTML += '<div class="text-center py-5" id="loader"><div class="spinner-border text-primary"></div></div>';

    let query = supabase
        .from('teacher_ads')
        .select('*')
        .eq('is_active', true);

    if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
    }
    
    // Note: Specialization array filter might need 'cs' (contains)
    if (filters.specialization && filters.specialization.length > 0) {
        query = query.contains('specialization', filters.specialization);
    }

    const { data: ads, error } = await query;

    document.getElementById('loader').remove();

    if (error) {
        container.innerHTML += `<div class="alert alert-danger">Gagal memuat mentor: ${error.message}</div>`;
        return;
    }

    if (!ads || ads.length === 0) {
        container.innerHTML += `<div class="text-center py-5 text-muted">Belum ada mentor yang cocok dengan kriteria pencarian.</div>`;
        return;
    }

    ads.forEach(ad => {
        const ratingStars = generateStars(ad.rating);
        const card = document.createElement('div');
        card.className = 'guru-card p-4 mb-3';
        card.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="position-relative">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(ad.display_name)}&background=random" class="avatar-img" alt="Guru">
                    ${ad.is_verified ? '<span class="position-absolute bottom-0 end-0 bg-primary text-white badge rounded-circle p-1" style="font-size:0.7rem"><i class="bi bi-check-lg"></i></span>' : ''}
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="fw-bold mb-0">${ad.display_name} ${ad.is_verified ? '<i class="bi bi-patch-check-fill badge-verified" title="Verified Mentor"></i>' : ''}</h5>
                            <p class="text-muted small mb-1">${ad.city || 'Online'} • ${ad.specialization ? ad.specialization.join(', ') : 'Matematika Umum'}</p>
                            <div class="text-warning small">
                                ${ratingStars}
                                <span class="text-muted ms-1">(${ad.review_count || 0} Ulasan)</span>
                            </div>
                        </div>
                        <span class="badge bg-success bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill">Rp ${parseInt(ad.rate_per_session).toLocaleString('id-ID')}/Sesi</span>
                    </div>
                    <p class="mt-2 mb-0 small text-secondary">
                        "${ad.bio || 'Siap membantu siswa menguasai matematika.'}"
                    </p>
                </div>
            </div>
            <hr class="my-3">
            <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-primary btn-sm rounded-pill fw-bold px-4" onclick="alert('Fitur Profil Detail Segera Hadir!')">Lihat Profil</button>
                <button class="btn btn-warning btn-sm rounded-pill fw-bold text-white px-4" onclick="contactGuru('${ad.whatsapp_number}')">Hubungi / Booking</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="bi bi-star-fill"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="bi bi-star-half"></i>';
        } else {
            stars += '<i class="bi bi-star"></i>';
        }
    }
    return stars;
}

window.contactGuru = function(wa) {
    if (!wa) return alert("Nomor kontak guru tidak tersedia.");
    window.open(`https://wa.me/${wa}`, '_blank');
}

// Initial Load
loadAds();

// Filter Logic (Simple implementation)
document.querySelector('button.w-100')?.addEventListener('click', () => {
    const city = document.querySelector('input[placeholder="Ketik kota..."]').value;
    loadAds({ city });
});