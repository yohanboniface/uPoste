// Variables globales
var TILES_URL = 'http://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    POSTE = "postes",
    BAL = "bal",
    PARKING = "parking_pmr",
    WHEELCHAIR = false,
    DEAF = false,
    DATA;
/* ********************************************** */
/*      Gestion de la page carte principale       */
/* ********************************************** */


$(document).on('pageinit', '#pageCarte', function() {
    // On crée la carte
    var map = L.map('map');

    // On ajoute un fond de carte
    var tilelayer = L.tileLayer(TILES_URL, {
        maxZoom: 20,
        attribution: 'OpenStreetMap contributors'
    });
    tilelayer.addTo(map);

    // On définit une position par défaut pour la carte
    map.setView([48.86763, 2.34971], 16);


    // Ecouteurs sur la carte
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    // Méthodes de géolocalisation
    function onLocationFound (e) {
        // On ajoute un marqueur sur la position géolocalisée
        L.marker(e.latlng).addTo(map);
    }
    function onLocationError (e) {
        // Il faudrait afficher un message à l'utilisateur
        console.log(e.message);
    }

    // Géolocalisation au click sur le bouton locateButton
    $('#locateButton').on('click', function () {
        map.locate({setView: true, maxZoom: 18, timeout: 10000});
    });

    // Méthode pour créer une icone
    function createIcon (path) {
        return L.icon({
            iconUrl: path,
            iconSize: [32, 37],
            popupAnchor:  [0, -16]
        });
    }

    // Methode pour afficher les points sur la carte
    var closestGroup = L.featureGroup().addTo(map);
    function displayPois () {
        closestGroup.clearLayers();
        var r, marker;
        for(var i=0; i < DATA.length; i++) {
            r = DATA[i];

            // Ajouter une icone spécifique pour signaler les malades
            var icon = createIcon('images/malade.png');
            marker = L.marker([r.lat, r.lng], {icon: icon});
            // marker.bindPopup(r['typeMaladie']);
            closestGroup.addLayer(marker);
        }
    }

    // Télécharger les icons depuis http://mapicons.nicolasmollet.com/
    // Afficher des icones spécifiques selon les catégories OpenStreetMap
    function pointToLayer (feature, latlng) {
        var path = "images/default.png";
        if (feature.properties.tourism === "hotel") {
            path = 'images/hotel.png';
        } else if (feature.properties.amenity === "hopital") {
            path = 'images/hopital.png';
        } else if (feature.properties.amenity === "school") {
            path = 'images/school.png';
        } else if (feature.properties.amenity === "place_of_worship") {
            if (feature.properties.religion === "christian") {
                path = 'images/christian.png';
            } else if (feature.properties.religion === "muslim") {
                path = 'images/muslim.png';
            }
        }
        var icon = createIcon(path);
        return L.marker(latlng, {icon: icon});
    }


    // Récupérer les POIs d'OpenStreetMap et les afficher sur la carte
    function onEachFeature (feature, marker) {
        var content = "", value;
        if (feature.properties.name) {
            content += "<h3>" + feature.properties.name + "</h3>";
        }
        for (var key in feature.properties) {
            // On ne veut pas afficher cette clé
            if (key === "@id") {
                continue;
            }
            content += "<p><strong>" + key + ": </strong>" + feature.properties[key] + "</p>";
        }
        marker.bindPopup(content);
    }
    var options = {
        onEachFeature: onEachFeature,
        pointToLayer: pointToLayer
    };

    // On crée les deux groupes de données (layers), mais sans aucune
    // donnée pour l'instant (les données seront ajoutées lors du 
    // premier clic)
    var balGroup = L.geoJson(null, options);
    var posteGroup = L.geoJson(null, options);
    var parkingGroup = L.geoJson(null, options);


    function toggleLayer(group, path, buttonId, name) {
        // On teste si la carte contient déjà le groupe
        if (map.hasLayer(group)) {
            // Si oui, on l'enlève de la carte
            map.removeLayer(group);
            $(buttonId + ' .ui-btn-text').html('Afficher les ' + name);
        } else { // Sinon
            // D'abord, on teste si le groupe contient des marqueurs
            if (!group.getLayers().length) {
                // S'il n'en contient pas, alors on va chercher les 
                // données sur le serveur
                $.getJSON(path, function (data) {
                    console.log(path, data.features.length)
                    group.addData(data);
                });
            }
            // Dans tous les cas, on ajoute le groupe à la carte
            group.addTo(map);
            $(buttonId + ' .ui-btn-text').html('Masquer les ' + name);
        }
    }

    function displayClosest(type) {
        db.transaction(function(tx) {
          tx.executeSql('SELECT * FROM ' + type, [], function (tx, rs) {
            console.log('displayClosest')
                var rows = [];
                for(var i=0; i < rs.rows.length; i++) {
                    rows.push(rs.rows.item(i));
                }
                DATA = Utils.closest(rows, map.getCenter());
                displayPois();
          });
        });
    }

    $('#balButton').on('click', function () {
        toggleLayer(balGroup, 'data/bal.geojson', '#balButton', 'BaL');
    });
    $('#closestPosteButton').on('click', function () {
        displayClosest(POSTE);
    });
    $('#closestBalButton').on('click', function () {
        displayClosest(BAL);
    });
    $('#posteButton').on('click', function () {
        toggleLayer(posteGroup, 'data/postes.geojson', '#posteButton', 'Bureaux');
    });
    $('#parkingButton').on('click', function () {
        toggleLayer(parkingGroup, 'data/parking_pmr.geojson', '#parkingButton', 'Parkings');
    });


    // Mise à jour des dimensions de la carte au chargement de la page
    $(document).on('pageshow', '#pageCarte', function() {
        // On force la taille du conteneur de la carte parce que
        // jquery mobile semble insérer la div trop tard au premier
        // chargement
        $('#map')[0].style.height = window.innerHeight + "px";
        // On demande à Leaflet de mettre à jour la taille de la carte
        map.invalidateSize();
        // On remet une taille dynamique
        $('#map')[0].style.height = "100%";

        // On va chercher les cas de maladies en base pour les afficher
        // sur la carte
        // db.transaction(function(tx) {
        //   tx.executeSql('SELECT * FROM Malades', [], displayMalades);
        // });
    });

});

var Utils = {
    closest: function (rows, center) {
        center = L.latLng(center);
        return rows.sort(function (a, b) {
            return center.distanceTo(L.latLng([a.lat, a.lng]))-center.distanceTo(L.latLng([b.lat, b.lng]));
        }).slice(0, 10);
    }
};

// Instancier la connexion avec la base de données
var db = window.openDatabase("data", "", "Data", 1024*1000);

function initData (type, func) {
    db.transaction(function(tx) {
        tx.executeSql('SELECT count(*) as total FROM ' + type, [], function (tx, rs) {
            var count = rs.rows.item(0);
            console.log(count)
            if (count.total === 0) {
                $.getJSON('data/' + type + '.geojson', function (data) {
                    for (var i = 0; i < data.features.length; i++) {
                        func(type, data.features[i]);
                    }
                });
            }
        });
    });
}

// Initialization de la base de données
$(document).ready(function() {
    db.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS postes (id INTEGER PRIMARY KEY, properties TEXT, wheelchair BOOLEAN, deaf BOOLEAN, lat FLOAT, lng FLOAT)', []);
    });
    db.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS bal (id INTEGER PRIMARY KEY, properties TEXT, lat FLOAT, lng FLOAT)', []);
    });
    initData(POSTE, insertPostesData);
    initData(BAL, insertBalData);
});

// Méthode pour insérer les données dans la base de données
function insertPostesData(type, feature) {
    db.transaction(function(tx) {
        var data = [
            JSON.stringify(feature.properties),
            !!feature.properties.Accessibilite_Entree_autonome_en_fauteuil_roulant_possible && !!feature.properties.Accessibilite_Absence_de_ressaut_de_plus_de_2_cm_de_haut,
            !!feature.properties.Accessibilite_Borne_sonore_en_etat_de_fonctionnement,
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0]
        ];
        tx.executeSql('INSERT INTO postes (properties, wheelchair, deaf, lat, lng) VALUES (?, ?, ?, ?, ?)', data);
    });
}
function insertBalData(type, feature) {
    db.transaction(function(tx) {
       tx.executeSql('INSERT INTO bal (properties, lat, lng) VALUES (?, ?, ?)', [JSON.stringify(feature.properties), feature.geometry.coordinates[1], feature.geometry.coordinates[0]]);
    });
}
function updateParameters () {
    WHEELCHAIR = !!$('#wheelchair').attr('checked');
    DEAF = !!$('#deaf').attr('checked');
}

/* ********************************************** */
/*  Gestion de la carte popup dans le formulaire  */
/* ********************************************** */

function displayMapPopup () {
    $('#popupMapWrapper').html('<div id="popupMapContainer"></div>');
    var map = L.map('popupMapContainer');
    L.tileLayer(TILES_URL, {
        maxZoom: 20,
        attribution: 'OpenStreetMap contributors'
    }).addTo(map);
    map.setView([12.1177, 15.0674], 13);
    map.on('click', function (e) {
        $('#formLat').val(e.latlng.lat);
        $('#formLng').val(e.latlng.lng);
        $('#mapFormPopup').popup('close');
    });
}

// On ajoute un écouteur au chargement de la page formulaire
$(document).on("pageinit", '#signalerMalade', function() {
    // Quand la page est initialisée, on ajoute un écouteur
    // sur l'ouverture de la popup
    $('#mapFormPopup').on('popupafteropen', displayMapPopup);
});
