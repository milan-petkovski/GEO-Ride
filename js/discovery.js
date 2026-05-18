let lastDiscoveredCity = null;
let lastCheckTime = 0;
let isDiscovering = false;

export function checkDiscovery(lng, lat, force = false) {
    // Only proceed if mapbox token is available and we aren't already checking
    if (!window.mapboxgl || !window.mapboxgl.accessToken || isDiscovering) return;
    
    const now = Date.now();
    // Only check every 10 seconds normally, unless forced (e.g. after teleport)
    if (!force && now - lastCheckTime < 1000) return;
    
    lastCheckTime = now;
    isDiscovering = true;
    
    // Reverse geocode to find the current city/locality
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&access_token=${window.mapboxgl.accessToken}`)
        .then(res => res.json())
        .then(data => {
            isDiscovering = false;
            if (data.features && data.features.length > 0) {
                const place = data.features[0];
                const cityName = place.text;
                
                // Try to find the country from the context array
                let countryName = '';
                if (place.context) {
                    const countryCtx = place.context.find(c => c.id.startsWith('country'));
                    if (countryCtx) countryName = countryCtx.text;
                }
                
                let finalCityName = cityName;
                if (finalCityName && finalCityName.toLowerCase() === 'savski venac') {
                    finalCityName = 'Belgrade Waterfront';
                }
                
                // If it's a new city we haven't discovered yet during this session
                if (finalCityName && finalCityName !== lastDiscoveredCity) {
                    lastDiscoveredCity = finalCityName;
                    showDiscoveryCinematic(finalCityName, countryName);
                }
            }
        })
        .catch(err => {
            isDiscovering = false;
            console.error('Discovery reverse-geocoding error:', err);
        });
}

function showDiscoveryCinematic(city, country) {
    const overlay = document.getElementById('location-discovery');
    const titleEl = document.getElementById('discovery-title');
    const countryEl = document.getElementById('discovery-country');
    
    if (!overlay || !titleEl) return;
    
    titleEl.textContent = city;
    if (countryEl) {
        countryEl.textContent = country;
        countryEl.style.display = country ? 'block' : 'none';
    }
    
    overlay.classList.add('show');
    
    // Auto-hide the cinematic after 3 seconds
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 3000);
}
