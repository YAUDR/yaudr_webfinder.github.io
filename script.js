document.addEventListener('DOMContentLoaded', function() {
  const map = L.map('map').setView([0, 0], 2);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(map);

  const logContainer = document.getElementById('log-container');
  const logList = logContainer.querySelector('ul');
  const compass = document.getElementById('compass');
  const arrow = compass.querySelector('.arrow');
  let searchInProgress = false;

  function logMessage(message) {
    const logItem = document.createElement('li');
    logItem.textContent = message;
    logList.appendChild(logItem);
    logList.scrollTop = logList.scrollHeight;
  }

  function findCompany(companyName, countryName, lat, lng, radius) {
    const overpassQuery = `
      [out:json];
      (
        node["amenity"="fast_food"]["name"="${companyName}"](around:${radius},${lat},${lng});
        way["amenity"="fast_food"]["name"="${companyName}"](around:${radius},${lat},${lng});
        relation["amenity"="fast_food"]["name"="${companyName}"](around:${radius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.elements && data.elements.length > 0) {
          data.elements.forEach(company => {
            let companyNameResult = companyName;
            let companyLocation = "unknown location";
            let companyPhone = "unknown phone number";

            if (company.tags && company.tags.name) {
              companyNameResult = company.tags.name;
            }

            if (company.lat && company.lon) {
              companyLocation = `latitude: ${company.lat}, longitude: ${company.lon}`;
            }

            if (company.tags && company.tags.phone) {
              companyPhone = company.tags.phone;
            }

            const message = `${companyName} found in ${countryName}:\nname: ${companyNameResult}\nlocation: ${companyLocation}\nphone: ${companyPhone}`;
            logMessage(message);
            addCompanyMarker(company.lat, company.lon, companyNameResult);
          });
        } else {
          logMessage(`no ${companyName} found in ${countryName} within the search radius.`);
        }
      })
      .catch(error => {
        console.error("error finding the company:", error);
        logMessage("error finding the company. please check the console for details.");
      })
      .finally(() => {
        searchInProgress = false;
        arrow.classList.remove('tweaking');
      });
  }

  function getCountryName(lat, lng) {
    return new Promise((resolve, reject) => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
        .then(response => response.json())
        .then(data => {
          if (data && data.address && data.address.country) {
            resolve(data.address.country);
          } else {
            resolve("unknown country");
          }
        })
        .catch(error => {
          console.error("error reverse geocoding:", error);
          resolve("unknown country");
        });
    });
  }

  function addCompanyMarker(lat, lng, name) {
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(name);
  }

  const lookupButton = document.getElementById('lookup');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const locationInput = document.getElementById('location');
  const companyInput = document.getElementById('company');
  const radiusInput = document.getElementById('radius');
  const locationInputs = document.getElementById('location-inputs');
  const coordinateInputs = document.getElementById('coordinate-inputs');
  const toggleLocationButton = document.getElementById('toggle-location');

  let usingCoordinates = false;

  toggleLocationButton.addEventListener('click', function() {
    usingCoordinates = !usingCoordinates;
    if (usingCoordinates) {
      locationInputs.style.display = 'none';
      coordinateInputs.style.display = 'block';
      toggleLocationButton.textContent = 'use location name';
    } else {
      locationInputs.style.display = 'block';
      coordinateInputs.style.display = 'none';
      toggleLocationButton.textContent = 'use coordinates';
    }
  });

  lookupButton.addEventListener('click', function() {
    if (searchInProgress) {
      logMessage("search already in progress. please wait.");
      return;
    }

    let lat, lng;
    const locationName = locationInput.value;
    const companyName = companyInput.value;
    const radius = parseInt(radiusInput.value) || 50000;

    searchInProgress = true;
    arrow.classList.add('tweaking');

    if (usingCoordinates) {
      lat = parseFloat(latitudeInput.value);
      lng = parseFloat(longitudeInput.value);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], 10);

        getCountryName(lat, lng)
          .then(countryName => {
            findCompany(companyName, countryName, lat, lng, radius);
          });
      } else {
        logMessage("invalid latitude or longitude. please enter valid values.");
        searchInProgress = false;
        arrow.classList.remove('tweaking');
      }
    } else {
      if (locationName) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`)
          .then(response => response.json())
          .then(data => {
            if (data && data.length > 0) {
              lat = parseFloat(data[0].lat);
              lng = parseFloat(data[0].lon);
              map.setView([lat, lng], 10);
              getCountryName(lat, lng)
                .then(countryName => {
                  findCompany(companyName, countryName, lat, lng, radius);
                });
            } else {
              logMessage("location not found.");
              searchInProgress = false;
              arrow.classList.remove('tweaking');
            }
          })
          .catch(error => {
            console.error("error geocoding location:", error);
            logMessage("error finding location. please check the console for details.");
            searchInProgress = false;
            arrow.classList.remove('tweaking');
          });
      } else {
        logMessage("invalid location. please enter a valid location.");
        searchInProgress = false;
        arrow.classList.remove('tweaking');
      }
    }
  });

  document.addEventListener('mousemove', function(e) {
    const mapElement = document.getElementById('map');
    const mapRect = mapElement.getBoundingClientRect();

    const mapCenterX = mapRect.left + mapRect.width / 2;
    const mapCenterY = mapRect.top + mapRect.height / 2;

    const angle = Math.atan2(e.clientX - mapCenterX, -(e.clientY - mapCenterY)) * (180 / Math.PI);

    compass.style.transform = `rotate(${angle}deg)`;
  });

  map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const companyName = companyInput.value;
    const radius = parseInt(radiusInput.value) || 50000;

    getCountryName(lat, lng)
      .then(countryName => {
        findCompany(companyName, countryName, lat, lng, radius);
      });
  });

  $(function() {
    $(".xp-window").draggable({
      handle: ".title-bar"
    }).resizable();
  });
});
