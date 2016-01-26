# apicBI
A communication layer between ICWS and Power BI

## Scripts

### `npm run start`
Starts the server.
```bash
node server.js,
```

### `npm run init`
Initializes the dataset in Power BI
```bash
node init.js,
```

### `npm run reinit`
Re-inits the Power BI dataset, which will effectively run an `ALTER TABLE` to the datasets.
```bash
node init.js -dataset ApicBI -reinit 1,
```
### `npm run clean`
Empties the tables in the dataset.
```bash
node clean.js -dataset ApicBI,
```

### `npm run kill_history`
Removes the lastUpdated.json file from assets/
```bash
node kill_history.js -filepath assets/lastUpdated.json,
```

### `npm run reset`
Does a complete reset by running the `clean`, `reinint` and `kill_history` scripts
```bash
npm run clean && npm run reinit && npm run kill_history
```
