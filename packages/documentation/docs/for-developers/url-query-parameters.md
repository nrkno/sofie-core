---
sidebar_label: URL Query Parameters
sidebar_position: 10
---

# URL Query Parameters
Appending query parameter(s) to the URL will allow you to modify the behaviour of the GUI, as well as control the [Access Levels](../user-guide/features/access-levels.md).

| Query Parameter                     | Description                                                               |
| :---------------------------------- | :------------------------------------------------------------------------ |
| `admin=1` | Gives the GUI the same access as the combination of [Configuration Mode](../user-guide/features/access-levels.md#Configuration-Mode) and [Studio Mode](../user-guide/features/access-levels.md#Studio-Mode) as well as having access to a set of [Testing Mode](../user-guide/features/access-levels.md#Testing-Mode) tools and a Manual Control section on the Rundown page. _Default value is `0`._ | 
| `studio=1` | [Studio Mode](../user-guide/features/access-levels.md#Studio-Mode) gives the GUI full control of the studio and all information associated to it. This includes allowing actions like activating and deactivating rundowns, taking parts, adlibbing, etcetera. _Default value is `0`._ | 
| `buckets=0,1,...`                  | The buckets can be specified as base-0 indices of the buckets as seen by the user. This means that `?buckets=1` will display the second bucket as seen by the user when not filtering the buckets. This allows the user to decide which bucket is displayed on a secondary attached screen simply by reordering the buckets on their main view. |
| `develop=1` | Enables the browser's default right-click menu to appear. It will also reveal the _Manual Control_ section on the Rundown page. _Default value is `0`._ |
| `display=layout,buckets,inspector` | A comma-separated list of features to be displayed in the shelf. Available values are: `layout` \(for displaying the Rundown Layout\), `buckets` \(for displaying the Buckets\) and `inspector` \(for displaying the Inspector\).           |
| `help=1` | Enables some tooltips that might be useful to new users. _Default value is `0`._ | 
| `ignore_piece_content_status=1` | Removes the "zebra" marking on VT pieces that have a "missing" status. _Default value is `0`._ | 
| `reportNotificationsId=anyId,...` | Sets an ID for an individual client GUI system, to be used for reporting Notifications shown to the user. The Notifications' contents, tagged with this ID, will be sent back to the Sofie Core's log. _Default value is `0`, which disables the feature._  |  
| `shelffollowsonair=1` | _Default value is `0`._ | 
| `show_hidden_source_layers=1` | _Default value is `0`._ | 
| `speak=1` | Experimental feature that starts playing an audible countdown 10 seconds before each planned _Take_. _Default value is `0`._ | 
| `vibrate=1` | Experimental feature that triggers the vibration API in the web browser 3 seconds before each planned _Take_. _Default value is `0`._ | 
| `zoom=1,...` | Sets the scaling of the entire GUI. _The unit is a percentage where `100` is the default scaling._ | 


