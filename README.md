# apicBI
A communication layer between ICWS and Power BI

## Scripts

### `npm run init`
Initializes the dataset in Power BI
```bash
node init.js
```

### `npm run reinit`
Re-inits the Power BI dataset, which will effectively run an `ALTER TABLE` to the datasets.
```bash
node init.js -dataset ApicBI -reinit 1,
```

### `npm run clean`
Empties the tables in the dataset.
```bash
node clean.js -dataset ApicBI
```

### `npm run clear_history`
Removes the lastUpdated.json file from the assets folder,
effectively resets the application to the current week.
```bash
node clear_file.js -filepath assets/lastUpdated.json
```

### `npm run clear_token`
Removes the token.json file from the assets folder,
which will force the application to fetch a new token before using.
```bash
node clear_file.js -filepath assets/token.json
```

### `npm run clear_dataset`
Removes the datasets_ApicBI.json file from the assets folder,
forcing the application to check Power BI for the datasetId.
```bash
node clear_file.js -filepath assets/datasets_ApicBI.json
```

### `npm run clear_session`
Clears the session by deleting lastUpdated.json, token.json and datasets_ApicBI.json
from the assets folder.
```bash
npm run clear_history && npm run clear_token && npm run clear_dataset
```

### `npm run reset`
Does a complete reset of the application, where datasets are initialized
and state files are deleted.
```bash
npm run clean && npm run init && npm run clear_session
```

### `npm run hard_reset`
Does a complete reset of the application, where datasets are reinitialized
and state files are deleted.
```bash
npm run clean && npm run reinit && npm run clear_session
```

### `npm run serve`
Runs the server in a forever instance, which will restart when crashed.
```bash
forever -c node server.js
```
