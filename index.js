const sensor = require('node-dht-sensor');
const fetch = require('node-fetch');
const five = require('johnny-five');
const Raspi = require('raspi-io');
const moment = require('moment');

const DHT_SENSOR = process.env.DHT_SENSOR || 11;

const DHT_GPIO = process.env.DHT_GPIO || 21;
const HEATER_GPIO = process.env.HEATER_GPIO || 13;
const COOLER_GPIO = process.env.COOLER_GPIO || 6;
const HUMIDITIFIER_GPIO = process.env.HUMIDITIFIER_GPIO || 26;

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/api/params';

class Board {
    constructor() {

        this.board = new five.Board({
            io: new Raspi()
        });

        this.state = {
            cooler: false,
            heater: false,
            humiditifier: false
        }

        this.board.on('ready', this.onReady.bind(this));
        this.board.on('exit', this.onExit.bind(this));

        this.setSignals.bind(this);
    }

    onReady() {

        this.HEATER = new five.Led(`GPIO${HEATER_GPIO}`);
        this.COOLER = new five.Led(`GPIO${COOLER_GPIO}`);
        this.HUMIDITIFIER = new five.Led(`GPIO${HUMIDITIFIER_GPIO}`);

        setInterval(() => {
    
            this.getData()
            .then(data => {
                this.setSignals(data);
                this.postDataToServer(data);
            })
            .catch(err => {
                console.log(err);
            })
    
        }, 2000);
    }

    getData() {
        return new Promise((resolve, reject) => {
            sensor.read(DHT_SENSOR, DHT_GPIO, (err, temperature, humidity) => {
                if (!err) {
        
                    const time = `${Date.now()}`.slice(0, -3);
        
                    console.log('temp: ' + temperature.toFixed(1) + '°C, ' +
                        'humidity: ' + humidity.toFixed(1) + '%'
                    );
        
                    resolve({temperature, humidity, time});
                }
        
                else {
                    reject(err);
                }
            })
        })
    }

    setSignals(data) {
        const { temperature, humidity, time } = data;
        const hour = moment.unix(time).hour();
        const daytime = hour < 19 && hour > 9;
        const { heater: prevHeaterState,
                cooler: prevCollerState,
                humiditifier: prevHumiditifierState } = this.state;
        
        let heaterState = null;
        let coolerState = null;
        const humiditifierState = humidity < 60;


        if(daytime) {
            heaterState = temperature < 24;
            coolerState = temperature > 27;
        }
        else {
            heaterState = temperature < 16;
            coolerState = temperature > 18;
        }

        heaterState ? this.HEATER.on() : this.HEATER.off();
        coolerState ? this.COOLER.on() : this.COOLER.off();
        humiditifierState ? this.HUMIDITIFIER.on() : this.HUMIDITIFIER.off();

        this.state = {
            cooler: coolerState,
            heater: heaterState,
            humiditifier: humiditifierState
        }

        console.log(this.state);
    }

    postDataToServer(data) {
    
        fetch(SERVER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(() => console.log('send success'))
        .catch(err => console.log(err))
    }

    onExit() {
        this.HEATER.off();
        this.COOLER.off();
        this.HUMIDITIFIER.off();
        console.log('Exiting...');
    }
}

const board = new Board();