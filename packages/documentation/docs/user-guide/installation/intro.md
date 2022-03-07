---
sidebar_position: 1
---
# Getting Started

_Sofie_ can be installed in many different ways, depending on which platforms, needs, and features you desire. The _Sofie_ system consists of several applications that work together to provide complete broadcast automation system. Each of these components' installation will be covered in this guide. Additional information about the products or services mentioned alongside the Sofie Installation can be found on the [Further Reading page](../resources.md).

There are four minimum required components to get a Sofie system up and running. First you need the [_Sofie Core_](installing-sofie-server-core.md), which is the brains of the operation. Then a set of [_Blueprints_](installing-blueprints.md) to handle and interpret incoming and outgoing data. Next, an [_Ingest Gateway_](installing-a-gateway/rundown-or-newsroom-system-connection/README) to fetch the data for the Blueprints. Then finally, a [_Playout Gateway_](installing-a-gateway/playout-gateway.md) to send the data to your playout device of choice.



## Sofie Core Pages

The _Rundowns_ page will display all the active rundowns that the _Sofie Core_ has access to. 

![Rundown Page](/img/docs/getting-started/rundowns-in-sofie.png)

The _Status_ pages displays the current status for the attached devices and gateways.

![Status Page &#x2013; Describes the state of _Sofie Core_](/img/docs/getting-started/status-page.jpg)

The _Settings_ pages contains various settings for the studio, show styles, blueprints etc.. If the link to the settings page is not visible in your application, check your [Access Levels](../features/access-levels.md). More info on specific parts of the _Settings_ page can be found in their corresponding guide sections. 

![Settings Page &#x2013; Describes how the _Sofie Core_ is configured](/img/docs/getting-started/settings-page.jpg)

## Sofie Core Overview

The _Sofie Core_ is the primary application for managing the broadcast but, it doesn't play anything out on it's own. You need to use Gateways to establish the connection from the _Sofie Core_ to other pieces of hardware or remote software. 

### Gateways

Gateways are separate applications that bridge the gap between the _Sofie Core_ and other pieces of hardware or services. At minimum, you will need a _Playout Gateway_ so your timeline can interact with your playout system of choice. To install the _Playout Gateway_, visit the [Installing a Gateway](installing-a-gateway/intro) section of this guide and for a more in-depth look, please visit the [Under the Hood section – Gateways](../dictionary#gateways). 

### Blueprints

Blueprints can be described as the logic that determines how a studio and show should interact with one another. They interpret the data coming in from the rundowns and transform them into a rich set of playable elements \(_Segments_, _Parts_, _AdLibs,_ etcetera\). The _Sofie Core_ has three main blueprint types, _System Blueprints_, _Studio Blueprints_, and _Showstyle Blueprints_. Installing _Sofie_ does not require you understand what these blueprints do, just that they are required for the _Sofie Core_ to work. If you would like to gain a deeper understand of how _Blueprints_ work, please visit the [Under The Hood – Blueprints](../dictionary#blueprints) section.

