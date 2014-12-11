all: build

build: clean
	cd chrome/isreaditlater && zip -r isreaditlater.jar *
	mkdir -p build/chrome
	mv chrome/isreaditlater/isreaditlater.jar build/chrome
	cp -r components/ defaults/ install.rdf chrome.manifest build/
	cd build && zip -r pocket.xpi *

clean:
	rm -rf build/

.PHONY: all build clean
