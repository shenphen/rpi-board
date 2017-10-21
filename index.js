const sensor = require('node-dht-sensor');
const fetch = require('node-fetch');
const five = require('johnny-five');
const Raspi = require('raspi-io');
const moment = require('moment');

const GPIO_PORT = process.env.GPIO_PORT || 21;
const DHT_SENSOR = process.env.DHT_SENSOR || 11;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/api/params';

const board = new five.Board({
    io: new Raspi()
});

board.on('ready', function() {
    var led = new five.Led('P1-13');
    led.blink();
});

function onReady() {

    setInterval(() => {

        const data = getData();
        if(data) {
            const { temperature, humidity, time } = data;
            const daytime = moment.unix(time) < 19 && moment.unix(time) > 9;

            let HEATER = null;
            let COOLER = null;

            const HUMIDITIFIER = humidity < 60;

            if(daytime) {
                HEATER = temperature < 24;
                COOLER = temperature > 27;
            }
            else {
                HEATER = temperature < 16;
                COOLER = temperature > 18;
            }

            console.log({HUMIDITIFIER, HEATER, COOLER});

            postDataToServer({temperature, humidity, time});
        }


    }, 1000);
}

function getData() {
    sensor.read(DHT_SENSOR, GPIO_PORT, (err, temperature, humidity) => {
        if (!err) {

            const time = `${Date.now()}`.slice(0, -3);

            console.log('temp: ' + temperature.toFixed(1) + '°C, ' +
                'humidity: ' + humidity.toFixed(1) + '%'
            );

            return {temperature, humidity, time};

        }

        else {
            console.log(err);
            return null;
        }
    })
}

function postDataToServer(data) {

    fetch(SERVER_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(() => console.log('send success'))
    .catch(err => console.log(err))
}

process.on('exit', (code) => {
    console.log(`About to exit with code: ${code}`);
});