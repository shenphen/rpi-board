const sensor = require('node-dht-sensor');
const fetch = require('node-fetch');
const five = require('johnny-five');
const Raspi = require('raspi-io');
const moment = require('moment');
const io = require('socket.io-client');

const DHT_SENSOR = process.env.DHT_SENSOR || 11;

const DHT_GPIO = process.env.DHT_GPIO || 21;
const HEATER_GPIO = process.env.HEATER_GPIO || 13;
const COOLER_GPIO = process.env.COOLER_GPIO || 6;
const HUMIDITIFIER_GPIO = process.env.HUMIDITIFIER_GPIO || 26;

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_PATH = process.env.API_PATH || '/api/params';

class Board {
    constructor() {

        this.board = new five.Board({
            io: new Raspi()
        });

        this.state = {
            cooler: false,
            heater: false,
            humiditifier: false,
            manualControl: null,
        }

        this.board.on('ready', this.onReady.bind(this));
        this.board.on('exit', this.onExit.bind(this));

        this.setSignals = this.setSignals.bind(this);
    }

    onReady() {

        this.socket = io(SERVER_URL);
        this.socket.on('connect', () => console.log('connect'));
        this.socket.on('control', this.onControl.bind(this))
        this.socket.on('disconnect', () => {Object.assign(this.state, {manualControl: null}); console.log('disconnect')});

        this.HEATER = new five.Led(`GPIO${HEATER_GPIO}`);
        this.COOLER = new five.Led(`GPIO${COOLER_GPIO}`);
        this.HUMIDITIFIER = new five.Led(`GPIO${HUMIDITIFIER_GPIO}`);

        setInterval(() => {

            const { manualControl } = this.state;

            this.getData()
            .then(data => {
                manualControl ? this.setManualSignals() : this.setSignals(data);
                this.postDataToServer(data);
            })
            .catch(err => {
                manualControl && this.setManualSignals();
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
     
        const signals = this.getSignalsFromData(data);
        const { heater, cooler, humiditifier } = signals;

        heater ? this.HEATER.on() : this.HEATER.off();
        cooler ? this.COOLER.on() : this.COOLER.off();
        humiditifier ? this.HUMIDITIFIER.on() : this.HUMIDITIFIER.off();

        this.socket.emit('control', {
            autoControl: true,
            state: signals
        })

        Object.assign(this.state, signals);

        console.log(this.state);
    }

    setManualSignals(data) {
        const { manualControl } = this.state;

        if(manualControl !== null) {
            const { heater, cooler, humiditifier } = manualControl;

            heater ? this.HEATER.on() : this.HEATER.off();
            cooler ? this.COOLER.on() : this.COOLER.off();
            humiditifier ? this.HUMIDITIFIER.on() : this.HUMIDITIFIER.off();

            Object.assign(this.state, manualControl);
        }

        console.log(this.state);
    }

    getSignalsFromData(data) {
        const { temperature, humidity, time } = data;
        const hour = moment.unix(time).hour();
        const daytime = hour < 19 && hour > 9;

        const humiditifier = humidity < 60;
        let heater = null;
        let cooler = null;

        if(daytime) {
            heater = temperature < 24;
            cooler = temperature > 27;
        }
        else {
            heater = temperature < 16;
            cooler = temperature > 18;
        }

        return { heater, cooler, humiditifier }
    }

    postDataToServer(data) {
    
        fetch(SERVER_URL + API_PATH, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(() => console.log('send success'))
        .catch(err => console.log(err))
    }

    onControl(data) {
        if(data.manualControl && data.state) {
            const { cooler, heater, humiditifier } = data.state;
            Object.assign(this.state, {
                manualControl: {
                    cooler,
                    heater,
                    humiditifier
                }
            });
        }
        else {
            Object.assign(this.state, {manualControl: null})
        }
    }

    onExit() {
        this.HEATER.off();
        this.COOLER.off();
        this.HUMIDITIFIER.off();
        console.log('Exiting...');
    }
}

const board = new Board();