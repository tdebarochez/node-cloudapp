Node-cloudapp
===

Installation
===
```console
$ npm install cloudapp
```

Usage
===
```
var cloud = require("cloudapp")

cloud.setCredentials("email@address.com", "p4ssw0rd")
cloud.getItems({ page: 1, per_page: 10, deleted: 'false' }, console.log)
```

License
===

Node-cloudapp is licensed under the terms of the MIT License, see the included LICENSE file.
