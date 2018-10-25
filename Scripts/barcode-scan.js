// global vars
var initRequest = $.Deferred();
var arrBarcodes = [];

$(function () {
    "use strict";

    $('#getBarcodeBtn').on('click', function () {
        //initialize
        App.init();

    });

    $('#stopScanningBtn').on('click', function () {
        Quagga.stop();
        $('#bcInputView').css('display', 'none');
        $('#stopScanningBtn').css('display', 'none');
        $('#getBarcodeBtn').css('display', 'flex');
    });

    var App = {
        init: function () {
            Quagga.init(this.state, function (err) {
                if (err) {
                    console.log(err);
                    alert(err);
                    $('#getBarcodeBtn').removeClass('btn-success');
                    $('#getBarcodeBtn').addClass('btn-danger');
                    $('#getBarcodeBtn').html("Camera N/A");
                    $('#bcInputView').css('display', 'none');
                    return;
                }
                App.checkCapabilities();
                Quagga.start();

                if ($('#bcInputView').css('display') == 'none') {
                    $('#bcInputView').css('display', 'block');
                }
                $('#getBarcodeBtn').css('display', 'none');
                $('#stopScanningBtn').css('display', 'flex');
            });
        },
        checkCapabilities: function () {
            var track = Quagga.CameraAccess.getActiveTrack();
            var capabilities = {};
            if (typeof track.getCapabilities === 'function') {
                capabilities = track.getCapabilities();
                console.log(' track.getCapabilities() ', capabilities);
            }
            this.applySettingsVisibility('zoom', capabilities.zoom);
            this.applySettingsVisibility('torch', capabilities.torch);
        },
        applySettingsVisibility: function (setting, capability) {
            // depending on type of capability
            if (typeof capability === 'boolean') {
                var node = document.querySelector('input[name="settings_' + setting + '"]');
                if (node) {
                    node.parentNode.style.display = capability ? 'block' : 'none';
                }
                return;
            }
            if (window.MediaSettingsRange && capability instanceof window.MediaSettingsRange) {
                var node = document.querySelector('select[name="settings_' + setting + '"]');
                if (node) {
                    console.log(node);
                }
                return;
            }
        },
        _accessByPath: function (obj, path, val) {
            var parts = path.split('.'),
                depth = parts.length,
                setter = (typeof val !== "undefined") ? true : false;

            return parts.reduce(function (o, key, i) {
                if (setter && (i + 1) === depth) {
                    if (typeof o[key] === "object" && typeof val === "object") {
                        Object.assign(o[key], val);
                    } else {
                        o[key] = val;
                    }
                }
                return key in o ? o[key] : {};
            }, obj);
        },
        _convertNameToState: function (name) {
            return name.replace("_", ".").split("-").reduce(function (result, value) {
                return result + value.charAt(0).toUpperCase() + value.substring(1);
            });
        },
        applySetting: function (setting, value) {
            var track = Quagga.CameraAccess.getActiveTrack();
            if (track && typeof track.getCapabilities === 'function') {
                switch (setting) {
                    case 'zoom':
                        return track.applyConstraints({ advanced: [{ zoom: parseFloat(value) }] });
                    case 'torch':
                        return track.applyConstraints({ advanced: [{ torch: !!value }] });
                }
            }
        },
        setState: function (path, value) {
            var self = this;

            if (typeof self._accessByPath(self.inputMapper, path) === "function") {
                value = self._accessByPath(self.inputMapper, path)(value);
            }

            if (path.startsWith('settings.')) {
                var setting = path.substring(9);
                return self.applySetting(setting, value);
            }
            self._accessByPath(self.state, path, value);

            console.log(JSON.stringify(self.state));
            Quagga.stop();
            App.init();
        },
        inputMapper: {
            inputStream: {
                constraints: function (value) {

                        return {
                            width: { max: 320 },
                            height: { max: 240 }
                        };
                }
            },
            numOfWorkers: function (value) {
                return parseInt(value);
            },
            decoder: {
                readers: function (value) {
                    if (value === 'ean_extended') {
                        return [{
                            format: "ean_reader",
                            config: {
                                supplements: [
                                    'ean_5_reader', 'ean_2_reader'
                                ]
                            }
                        }];
                    }
                    return [{
                        format: value + "_reader",
                        config: {}
                    }];
                }
            }
        },
        state: {
            inputStream: {
                type: "LiveStream",
                target: document.querySelector('#bcInputView'),
                constraints: {
                    width: { max: 320 },
                    height: { max: 240 }
                }
            },
            locator: {
                patchSize: "large",
                halfSample: false
            },
            numOfWorkers: 2,
            frequency: 10,
            decoder: {
                readers: [{
                    format: "code_128_reader",
                    config: {}
                }]
            },
            locate: true
        },
        lastResult: null
    };

    Quagga.onProcessed(function (result) {
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
            }
        }
    });


    Quagga.onDetected(function (obj) {
        // log raw
        console.log(obj);
        // get barcode
        var barcodevalue = obj.codeResult.code;
        console.log("Barcode Value: " + barcodevalue);

        // RegEx
        var mme = /^(?=.{8}$)RP{1}\d{6}/;
        var found = barcodevalue.match(mme);
        var f = found === null ? false : true;
        // f true means barcode matches the pattern
        if (f === true) {
            // check accuracy
            var acc = obj.codeResult.startInfo.error;
            if (acc <= 0.095) {
                // accurracy good, add barcode to the list if the value has not already been added 
                if (arrBarcodes.findIndex(b => (b === barcodevalue)) == -1) {
                    arrBarcodes.push(barcodevalue);
                    updateBarcodeListView(); // refresh
                }
                else {
                    console.log("barcode already scanned ##########################################################");
                }
            }
            else {
                console.log("Barcode Accuracy error too high! Acc = " + acc);
            }
        }
        else {
            console.log('Invalid Barcode Value Scanned: ' + barcodevalue + '\nError%: ' + obj.codeResult.startInfo.error);
        }
    });

});

function updateBarcodeListView() {

    var bc = "";
    for (i = 0; i < arrBarcodes.length; i++) {
        var bcv = arrBarcodes[i].startsWith("RP") ? "default" : "danger";
        bc += ('<div class="btn btn-' + bcv + '" style="margin:4px;"><b>' + arrBarcodes[i] + ' </b><i id="bc-' + arrBarcodes[i] + '" class="glyphicon glyphicon-remove-circle" onclick="removeBarcode(this.id);"></i></div>');
    }
    $('#barcodeListView').html(bc);
    $('#scannedBarcodeCount').html("Count: " + arrBarcodes.length);
}

function removeBarcode(id) {
    console.log(id);
    var bc = id.substring(3, id.length);
    console.log("removing bc: " + bc);
    arrBarcodes.splice(arrBarcodes.findIndex(b => (b === bc)), 1);
    // refresh
    updateBarcodeListView();
}