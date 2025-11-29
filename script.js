// ===== MENU TOGGLE FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Initialize other functionalities
    initializeMap();
    initializeTimer();
    initializeVisitorCounter();
});

// ===== MAP FUNCTIONALITY =====
// ===== MAP FUNCTIONALITY =====
let map;
let userLocation = null;
let userMarker = null;
let hospitalMarkers = [];
let mapInitialized = false;

function initializeMap() {
    // Wait for DOM to be ready
    if (document.getElementById('map')) {
        console.log('Map element found, initializing...');
        
        // Initialize the map with minimal settings
        map = L.map('map', {
            center: [20.5937, 78.9629],
            zoom: 5,
            zoomControl: false // We'll add it later
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            minZoom: 3
        }).addTo(map);
        
        // Add zoom control after a delay
        setTimeout(() => {
            L.control.zoom({ position: 'topright' }).addTo(map);
        }, 1000);
        
        mapInitialized = true;
        console.log('Map initialized successfully');
        
        // Add event listeners for map buttons
        document.getElementById('locate-me').addEventListener('click', locateUser);
        document.getElementById('find-hospitals').addEventListener('click', findHospitals);
    } else {
        console.error('Map element not found!');
    }
}

// Add this new function to refresh the map
function refreshMap() {
    if (map && mapInitialized) {
        // Small delay to ensure the container is visible
        setTimeout(() => {
            try {
                map.invalidateSize(true);
                console.log('Map refreshed after menu open');
            } catch (error) {
                console.error('Error refreshing map:', error);
            }
        }, 300);
    }
}

function locateUser() {
    if (navigator.geolocation) {
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
                    .bindPopup('Your Location')
                    .openPopup();
                    
                document.getElementById('hospital-list').innerHTML = '<div class="loading">Location found! Click "Find Hospitals" to search</div>';
            },
            function(error) {
                alert('Unable to get your location. Please ensure location services are enabled.');
                console.error('Geolocation error:', error);
            }
        );
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

function findHospitals() {
    if (!userLocation) {
        alert('Please click "Locate Me" first to find your location.');
        return;
    }
    
    document.getElementById('hospital-list').innerHTML = '<div class="loading">Searching for hospitals...</div>';
    
    // Clear existing hospital markers
    hospitalMarkers.forEach(marker => map.removeLayer(marker));
    hospitalMarkers = [];
    
    // Use Overpass API to find hospitals
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:5000,${userLocation.lat},${userLocation.lng});out;`;
    
    fetch(overpassUrl)
        .then(response => response.json())
        .then(data => {
            const hospitals = data.elements;
            const hospitalList = document.getElementById('hospital-list');
            
            if (hospitals.length === 0) {
                hospitalList.innerHTML = '<div class="loading">No hospitals found nearby. Try expanding your search area.</div>';
                return;
            }
            
            // Sort hospitals by distance
            hospitals.sort((a, b) => {
                const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lon);
                const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lon);
                return distA - distB;
            });
            
            // Display hospitals in list
            let hospitalHTML = '';
            hospitals.slice(0, 10).forEach(hospital => {
                const distance = calculateDistance(userLocation.lat, userLocation.lng, hospital.lat, hospital.lon);
                
                hospitalHTML += `
                    <div class="hospital-item" data-lat="${hospital.lat}" data-lng="${hospital.lon}">
                        <div class="hospital-name">${hospital.tags.name || 'Unknown Hospital'}</div>
                        <div class="hospital-address">${hospital.tags['addr:street'] || 'Address not available'}</div>
                        <div class="hospital-distance">${distance.toFixed(1)} km away</div>
                    </div>
                `;
                
                // Add marker for hospital
                const hospitalMarker = L.marker([hospital.lat, hospital.lon])
                    .addTo(map)
                    .bindPopup(`
                        <strong>${hospital.tags.name || 'Unknown Hospital'}</strong><br>
                        ${hospital.tags['addr:street'] || ''}<br>
                        ${distance.toFixed(1)} km away
                    `);
                
                hospitalMarkers.push(hospitalMarker);
            });
            
            hospitalList.innerHTML = hospitalHTML;
            
            // Add click event to hospital list items
            document.querySelectorAll('.hospital-item').forEach(item => {
                item.addEventListener('click', function() {
                    const lat = parseFloat(this.getAttribute('data-lat'));
                    const lng = parseFloat(this.getAttribute('data-lng'));
                    map.setView([lat, lng], 15);
                    
                    // Highlight the clicked hospital
                    hospitalMarkers.forEach(marker => {
                        if (marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
                            marker.openPopup();
                        }
                    });
                });
            });
        })
        .catch(error => {
            console.error('Error fetching hospitals:', error);
            document.getElementById('hospital-list').innerHTML = '<div class="loading">Error loading hospitals. Please try again.</div>';
        });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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
    const timerDisplay = document.getElementById('timer-display');
    const startButton = document.getElementById('start-timer');
    const pauseButton = document.getElementById('pause-timer');
    const resetButton = document.getElementById('reset-timer');
    
    if (startButton && pauseButton && resetButton) {
        startButton.addEventListener('click', startTimer);
        pauseButton.addEventListener('click', pauseTimer);
        resetButton.addEventListener('click', resetTimer);
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

// ===== SEARCH FUNCTIONALITY =====
function searchEmergency() {
    const input = document.getElementById('search-bar').value.toLowerCase();
    const buttons = document.querySelectorAll('.emergency-list button');
    
    buttons.forEach(button => {
        const text = button.textContent.toLowerCase();
        if (text.includes(input)) {
            button.style.display = 'flex';
        } else {
            button.style.display = 'none';
        }
    });
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
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,kn,te,ta,gu,mr',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
}