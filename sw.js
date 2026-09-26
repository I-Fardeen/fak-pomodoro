const CACHE_NAME = "fak-pomodoro-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.svg",
    "./icons/icon-512.svg"
];


/* --------------------------------------------------
   Install
-------------------------------------------------- */

self.addEventListener(
    "install",
    (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.addAll(
                        APP_FILES
                    );
                })
                .then(() => {
                    return self.skipWaiting();
                })
        );
    }
);


/* --------------------------------------------------
   Activate
-------------------------------------------------- */

self.addEventListener(
    "activate",
    (event) => {
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames
                            .filter(
                                (name) =>
                                    name !==
                                    CACHE_NAME
                            )
                            .map(
                                (name) =>
                                    caches.delete(
                                        name
                                    )
                            )
                    );
                })
                .then(() => {
                    return self.clients.claim();
                })
        );
    }
);


/* --------------------------------------------------
   Fetch
-------------------------------------------------- */

self.addEventListener(
    "fetch",
    (event) => {
        /*
         * Only handle GET requests.
         */
        if (event.request.method !== "GET") {
            return;
        }

        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(event.request)
                        .then((response) => {

                            /*
                             * Only cache successful responses.
                             */
                            if (
                                !response ||
                                response.status !== 200 ||
                                response.type === "opaque"
                            ) {
                                return response;
                            }

                            const responseClone =
                                response.clone();

                            caches.open(
                                CACHE_NAME
                            ).then((cache) => {
                                cache.put(
                                    event.request,
                                    responseClone
                                );
                            });

                            return response;
                        });
                })
                .catch(() => {
                    return caches.match(
                        "./index.html"
                    );
                })
        );
    }
);