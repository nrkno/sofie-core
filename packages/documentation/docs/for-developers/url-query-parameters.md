---
sidebar_label: URL Query Parameters
sidebar_position: 10
---

# URL Query Parameters
Appending query parameters to the URL will allow you to modify the behaviour of the GUI, as well as control the access level.

| Query Parameter                     | Description                                                               |
| :---------------------------------- | :------------------------------------------------------------------------ |
| `?admin=0,1` | Default value is `0`. | 
| `?studio=0,1` | Default value is `0`. | 
| `?display=layout,buckets,inspector` | A comma-separated list of features to be displayed in the shelf. Available values are: `layout` \(for displaying the Rundown Layout\), `buckets` \(for displaying the Buckets\) and `inspector` \(for displaying the Inspector\).           |
| `?buckets=0,1,...`                  | The buckets can be specified as base-0 indices of the buckets as seen by the user. This means that `?buckets=1` will display the second bucket as seen by the user when not filtering the buckets. This allows the user to decide which bucket is displayed on a secondary attached screen simply by reordering the buckets on their main view.                         |
| `?shelffollowsonair=0,1` | | 
| `?speak=0,1` | Default value is `0`. | 
| `?vibrate=0,1` | Default value is `0`. | 
| `?help=0,1` | Default value is `0`. | 
| `?zoom=0,1` | Default value is `0`. | 
| `?show_hidden_source_layers=0,1` | Default value is `0`. | 
| `?ignore_piece_content_status=0,1` | Default value is `0`. | 
| `?reportNotificationsId=0,1` | Default value is `0`. | 
