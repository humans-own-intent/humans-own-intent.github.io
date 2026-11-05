# Zero-Build Offline Architecture with Vendored Dependencies

We decided to build the mindmap viewer as a zero-build static application using vanilla ES6+ JavaScript, native CSS, and HTML5, with dependencies (`d3.v7.min.js`, `js-yaml.min.js`) vendored locally into a `/vendor` directory. This eliminates build pipelines and Node/npm runtimes, guaranteeing instant offline portability and long-term maintenance simplicity across any static web host or local file system.
