
        // global vars
        var initRequest = $.Deferred();
        var arrBarcodes = [];

        (function () {

            "use strict";

            $('#getBarcodeBtn').on('click', function () {

                initBarcode();

                $.when(initRequest).done(function (success) {
                    if (success === true) {
                       // $('#getBarcodeBtn').html("SCANNING...");
                        if ($('#bcInputView').css('display') == 'none') {
                            $('#bcInputView').css('display', 'block');
                        }
                        $('#getBarcodeBtn').css('display', 'none');
                        $('#stopScanningBtn').css('display', 'flex');
                    }
                    else {
                        $('#getBarcodeBtn').removeClass('btn-success');
                        $('#getBarcodeBtn').addClass('btn-danger');
                        $('#getBarcodeBtn').html("Camera N/A");
                        $('#bcInputView').css('display', 'none');
                    }
                });

            });

            $('#stopScanningBtn').on('click', function () {
                Quagga.stop();
                $('#bcInputView').css('display', 'none');
                $('#stopScanningBtn').css('display', 'none');
                $('#getBarcodeBtn').css('display', 'flex');
            });

        }());


        function initBarcode() {

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector('#bcInputView'),    // Or '#yourElement' (optional)
                    constraints: {
                        width: 320,
                        height: 240,
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["code_128_reader"],
                    debug: {
                        drawBoundingBox: false,
                        showFrequency: false,
                        drawScanline: false,
                        showPattern: false
                    }
                },
                locate: true,
                locator: {
                    halfSample: false,
                    patchSize: "large", // x-small, small, medium, large, x-large
                    debug: {
                        showCanvas: false,
                        showPatches: false,
                        showFoundPatches: false,
                        showSkeleton: false,
                        showLabels: false,
                        showPatchLabels: false,
                        showRemainingPatchLabels: false,
                        boxFromPatches: {
                            showTransformed: false,
                            showTransformedBox: false,
                            showBB: false
                        }
                    }
                },
                debug: true
            }, function (err) {
                if (err) {
                    console.log(err);
                    alert(err);
                    initRequest.resolve(false);
                    return;
                }
                else {
                    initRequest.resolve(true);
                }
                console.log("Initialization finished. Ready to start");
                Quagga.start();
            });

            Quagga.onDetected(onBarcodeDetected);

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


        }

        function onBarcodeDetected(obj) {
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
        }

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