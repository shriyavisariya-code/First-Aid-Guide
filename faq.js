// ===== FAQ TOGGLE FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', function() {
    initializeFAQToggle();
    initializeMenuToggle();
    initializeMap();
    initializeTimer();
    initializeVisitorCounter();
});

function initializeFAQToggle() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const isActive = question.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-question').forEach(q => {
                q.classList.remove('active');
            });
            document.querySelectorAll('.faq-answer').forEach(a => {
                a.classList.remove('active');
            });
            
            // If the clicked question wasn't active, open it
            if (!isActive) {
                question.classList.add('active');
                answer.classList.add('active');
            }
        });
    });
}

// ===== MENU TOGGLE FUNCTIONALITY =====
function initializeMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const collapsibleSections = document.getElementById('collapsibleSections');
    const menuIcon = menuToggle.querySelector('i');
    
    // Ensure sections are hidden on page load
    collapsibleSections.style.display = 'none';
    
    menuToggle.addEventListener('click', function(event) {
        event.stopPropagation();
        const isActive = collapsibleSections.classList.contains('active');
        
        if (isActive) {
            // Hide sections
            collapsibleSections.classList.remove('active');
            menuToggle.classList.remove('active');
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
            
            setTimeout(() => {
                collapsibleSections.style.display = 'none';
            }, 300);
        } else {
            // Show sections
            collapsibleSections.style.display = 'block';
            setTimeout(() => {
                collapsibleSections.classList.add('active');
                menuToggle.classList.add('active');
                menuIcon.classList.remove('fa-bars');
                menuIcon.classList.add('fa-times');
                refreshMap(); // Refresh map when menu is opened
            }, 10);
        }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!menuToggle.contains(event.target) && 
            !collapsibleSections.contains(event.target) &&
            collapsibleSections.classList.contains('active')) {
            
            collapsibleSections.classList.remove('active');
            menuToggle.classList.remove('active');
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
            
            setTimeout(() => {
                collapsibleSections.style.display = 'none';
            }, 300);
        }
    });
}

// ===== MAP FUNCTIONALITY =====
let map;
let userLocation = null;
let userMarker = null;
let hospitalMarkers = [];

function initializeMap() {
    if (!document.getElementById('map')) {
        console.log('Map element not found on this page');
        return;
    }

    try {
        // Initialize map with default view (India)
        map = L.map('map').setView([20.5937, 78.9629], 5);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
        
        // Add zoom control
        L.control.zoom({ position: 'topright' }).addTo(map);
        
        console.log('Map initialized successfully');
        
        // Add event listeners
        document.getElementById('locate-me').addEventListener('click', locateUser);
        document.getElementById('find-hospitals').addEventListener('click', findHospitals);
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function refreshMap() {
    if (map) {
        setTimeout(() => {
            try {
                map.invalidateSize();
                console.log('Map refreshed');
            } catch (error) {
                console.error('Error refreshing map:', error);
            }
        }, 300);
    }
}

function locateUser() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    const locateButton = document.getElementById('locate-me');
    const originalText = locateButton.textContent;
    
    // Show loading state
    locateButton.textContent = 'Locating...';
    locateButton.disabled = true;

    navigator.geolocation.getCurrentPosition(
        function(position) {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Update map view
            map.setView([userLocation.lat, userLocation.lng], 13);
            
            // Add or update user marker
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            userMarker = L.marker([userLocation.lat, userLocation.lng])
                .addTo(map)
                .bindPopup('<strong>Your Location</strong>')
                .openPopup();
                
            document.getElementById('hospital-list').innerHTML = 
                '<div class="loading">Location found! Click "Find Hospitals" to search nearby medical facilities.</div>';
            
            // Reset button
            locateButton.textContent = originalText;
            locateButton.disabled = false;
        },
        function(error) {
            let errorMessage = 'Unable to get your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
            }
            
            alert(errorMessage);
            console.error('Geolocation error:', error);
            
            // Reset button
            locateButton.textContent = originalText;
            locateButton.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function findHospitals() {
    if (!userLocation) {
        alert('Please click "Locate Me" first to find your location.');
        return;
    }

    const findButton = document.getElementById('find-hospitals');
    const originalText = findButton.textContent;
    
    // Show loading state
    findButton.textContent = 'Searching...';
    findButton.disabled = true;
    
    document.getElementById('hospital-list').innerHTML = '<div class="loading">Searching for hospitals within 5km...</div>';
    
    // Clear existing hospital markers
    hospitalMarkers.forEach(marker => map.removeLayer(marker));
    hospitalMarkers = [];
    
    // Use Overpass API to find hospitals and clinics
    const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:5000,${userLocation.lat},${userLocation.lng});
          node["amenity"="clinic"](around:5000,${userLocation.lat},${userLocation.lng});
          node["healthcare"="hospital"](around:5000,${userLocation.lat},${userLocation.lng});
          node["healthcare"="clinic"](around:5000,${userLocation.lat},${userLocation.lng});
        );
        out body;
        >;
        out skel qt;
    `;
    
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
    fetch(overpassUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const facilities = data.elements;
            const hospitalList = document.getElementById('hospital-list');
            
            if (facilities.length === 0) {
                hospitalList.innerHTML = 
                    '<div class="loading">No medical facilities found within 5km. Try moving to a more populated area.</div>';
                return;
            }
            
            // Sort facilities by distance
            facilities.sort((a, b) => {
                const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lon);
                const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lon);
                return distA - distB;
            });
            
            // Display facilities in list
            let hospitalHTML = '';
            facilities.slice(0, 8).forEach(facility => {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, facility.lat, facility.lon);
                const name = facility.tags.name || 'Medical Facility';
                const type = facility.tags.amenity === 'hospital' ? 'Hospital' : 
                            facility.tags.healthcare === 'hospital' ? 'Hospital' : 'Clinic';
                const address = facility.tags['addr:street'] || facility.tags['addr:full'] || 'Address not available';
                
                hospitalHTML += `
                    <div class="hospital-item" data-lat="${facility.lat}" data-lng="${facility.lon}">
                        <div class="hospital-name">${name}</div>
                        <div class="hospital-address">${type} • ${address}</div>
                        <div class="hospital-distance">${distance.toFixed(1)} km away</div>
                    </div>
                `;
                
                // Add marker for facility
                const facilityMarker = L.marker([facility.lat, facility.lon])
                    .addTo(map)
                    .bindPopup(`
                        <strong>${name}</strong><br>
                        ${type}<br>
                        ${address}<br>
                        <em>${distance.toFixed(1)} km away</em>
                    `);
                
                hospitalMarkers.push(facilityMarker);
            });
            
            hospitalList.innerHTML = hospitalHTML;
            
            // Add click event to hospital list items
            document.querySelectorAll('.hospital-item').forEach(item => {
                item.addEventListener('click', function() {
                    const lat = parseFloat(this.getAttribute('data-lat'));
                    const lng = parseFloat(this.getAttribute('data-lng'));
                    map.setView([lat, lng], 16);
                    
                    // Highlight the clicked facility
                    hospitalMarkers.forEach(marker => {
                        if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
                            marker.openPopup();
                        }
                    });
                });
            });
            
            // Reset button
            findButton.textContent = originalText;
            findButton.disabled = false;
        })
        .catch(error => {
            console.error('Error fetching medical facilities:', error);
            document.getElementById('hospital-list').innerHTML = 
                '<div class="loading">Error loading medical facilities. Please check your internet connection and try again.</div>';
            
            // Reset button
            findButton.textContent = originalText;
            findButton.disabled = false;
        });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ===== TIMER FUNCTIONALITY =====
let timerInterval;
let timerRunning = false;
let seconds = 0, minutes = 0, hours = 0;

function initializeTimer() {
    const startButton = document.getElementById('start-timer');
    const pauseButton = document.getElementById('pause-timer');
    const resetButton = document.getElementById('reset-timer');
    
    if (startButton && pauseButton && resetButton) {
        startButton.addEventListener('click', startTimer);
        pauseButton.addEventListener('click', pauseTimer);
        resetButton.addEventListener('click', resetTimer);
        updateTimerDisplay();
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');
        timerDisplay.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }
}

function startTimer() {
    if (!timerRunning) {
        timerRunning = true;
        timerInterval = setInterval(() => {
            seconds++;
            if (seconds >= 60) {
                seconds = 0;
                minutes++;
                if (minutes >= 60) {
                    minutes = 0;
                    hours++;
                }
            }
            updateTimerDisplay();
        }, 1000);
    }
}

function pauseTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    seconds = 0;
    minutes = 0;
    hours = 0;
    updateTimerDisplay();
}

// ===== VISITOR COUNTER =====
function initializeVisitorCounter() {
    let count = localStorage.getItem('visitorCount') || 0;
    count = parseInt(count) + 1;
    localStorage.setItem('visitorCount', count);
    document.getElementById('visitor-count').textContent = count;
}

// ===== GOOGLE TRANSLATE =====
function googleTranslateElementInit() {
    if (typeof google !== 'undefined' && google.translate) {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,hi,es,fr,de,zh,ar,ru,ja,ko',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE
        }, 'google_translate_element');
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && map) {
        setTimeout(() => {
            refreshMap();
        }, 100);
    }
});