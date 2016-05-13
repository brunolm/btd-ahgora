# Beat The Dot Ahgora

Scrapes Ahgora page to check when you have to clock in/out.

Sample usage:

```
npm start -- -c a123456 -u 1 -p 123456 -t 10 -a 11:30 -l 60 -w 8 -s
```

## Params

The command line parameters are:

```
-c, --company [code]          Ahgora company code
-u, --user [user]             Ahgora user code
-p, --pass [pass]             Ahgora pass code
-t, --tolerance [minutes]     Tolerance minutes (ex: 10)
-a, --lunch-at [HH:mm]        Lunch time (ex: 11:30)
-l, --lunch-time [minutes]    Lunch minutes (ex: 60)
-w, --work-hours [hours]      Total work hours a day (ex: 8)
-s, --show-grid               Shows whole month grid
```

If not specified it tries to read from environment variables:

```
AHGORA_COMPANY
AHGORA_USER
AHGORA_PASS
AHGORA_TOLERANCE
AHGORA_LUNCHAT
AHGORA_LUNCHTIME
AHGORA_WORKHOURS
AHGORA_SHOWGRID
```