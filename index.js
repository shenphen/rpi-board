const sensor = require('node-dht-sensor');
const fetch = require('node-fetch');

const GPIO_PORT = process.env.GPIO_PORT || 21;
const DHT_SENSOR = process.env.DHT_SENSOR || 11;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/api/params';

setInterval(() => {
    sensor.read(DHT_SENSOR, GPIO_PORT, (err, temperature, humidity) => {
        if (!err) {

            const time = `${Date.now()}`.slice(0, -3);

            console.log('temp: ' + temperature.toFixed(1) + '°C, ' +
                'humidity: ' + humidity.toFixed(1) + '%'
            );

            fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({temperature, humidity, time})
            })
            .then(() => console.log('send success'))
            .catch(err => console.log(err))
        }

        else {
            console.log(err);
        }
    })
}, 1000);