all: build

build: clean
	cd chrome && zip -r isreaditlater.jar isreaditlater
	mkdir -p build/chrome
	mv chrome/isreaditlater.jar build/chrome
	cp -r components/ defaults/ install.rdf chrome.manifest build/
	cd build && zip -r pocket.xpi *

clean:
	rm -rf build/

.PHONY: all build clean
