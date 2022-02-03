# ProProtein

Web service for making and visualizing molecular dynamics simulations which speeds up conducting research.

This project is the result of Engineering Thesis made at the Poznań University of Technology, WIiT, 2022.

This project wouldn't be possible without great help and support from our thesis supervisor **dr hab. inż. Aleksandra Świercz**.

Special thanks to **dr hab. inż. Maciej Antczak** for inspiration and interesting ideas.

## About project

Website is currently up and running at [https://proprotein.cs.put.poznan.pl](https://proprotein.cs.put.poznan.pl). Service gives users and researchers the ability to simulate molecular dynamics using the [GROMACS](https://www.gromacs.org), as well as the ability to visualize the results using the [Mol*](https://molstar.org/). When the simulation is finished, additional calculations are performed, where, among others, the RMSD measure is calculated, and on its basis, the areas of the highest fluctuation in the simulation are determined.
Every logged in user has the ability to create projects. Each project defines and runs only one simulation. After the simulation is finished, entering project will show results of the simulation.

## How to run a simulation
1. Account lets you make new projects and simulations.

![new project](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/new_project.png?raw=true)

2. Specify structure. You can use demo structure available on our server.

![selecting demo](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/selecting_demo.png?raw=true)

4. Define other parameters as you wish. When everything is ready, Request your simulation.

![simulation parameters](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/sim_params_short.png?raw=true)

5. After some time, you'll be notified about finished simulation. Open results in [Mol*](https://molstar.org/) to see special areas.

![finished project](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/finished_project.png?raw=true)

6. You can toggle between default view and colored view to see and analize important to you data.

![visualization default](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/default.png?raw=true)

7. Special areas are marked up by red.

![visualization colored](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/colored.png?raw=true)

## How is it possible?

All of these is possible with great tools such as:

![GROMACS logo](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/GROMACS.webp?raw=true)

[GROMACS](https://www.gromacs.org)

[GROMACS documentation](https://doi.org/10.5281/zenodo.5849961)

- [Bekker et al. (1993)](https://manual.gromacs.org/current/reference-manual/references.html#refbekker93a)
- [Berendsen et al. (1995)](https://manual.gromacs.org/current/reference-manual/references.html#refberendsen95a)
- [Lindahl et al. (2001)](https://manual.gromacs.org/current/reference-manual/references.html#reflindahl2001a)
- [van der Spoel at al. (2005)](https://manual.gromacs.org/current/reference-manual/references.html#refspoel2005a)
- [Hess et al. (2008)](https://manual.gromacs.org/current/reference-manual/references.html#refhess2008b)
- [Pronk et al. (2013)](https://manual.gromacs.org/current/reference-manual/references.html#refpronk2013)
- [Pall et al. (2015)](https://manual.gromacs.org/current/reference-manual/references.html#refpall2015)
- [Abraham et al. (2015)](https://manual.gromacs.org/current/reference-manual/references.html#refabraham2015)
---
![Molstar logo](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/molstar-logo.png?raw=true)

[Mol*](https://molstar.org/)
David Sehnal, Sebastian Bittrich, Mandar Deshpande, Radka Svobodová, Karel Berka, Václav Bazgier, Sameer Velankar, Stephen K Burley, Jaroslav Koča, Alexander S Rose:
[Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures](https://doi.org/10.1093/nar/gkab314), Nucleic Acids Research, 2021; [https://doi.org/10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314).

## How does it work under the hood?

<!-- ```mermaid
sequenceDiagram
Note left of User: Defining<br>new<br>simulation
User->>Server: Requesting<br>simulation
Server->>Queue Manager: Notifying about<br>new simulation
Note left of Queue Manager: Adding<br>new<br>simulation<br>to local<br>queue
Note left of Queue Manager: When<br>simulation<br>is first<br>in queue
Queue Manager->>GROMACS API: Sending all<br>necessary files*<br>and parameters<br>for our simulation
Note right of GROMACS API: Running simulation
Note right of GROMACS API: Calculating RMSD
Note right of GROMACS API: Gathering information<br>about the areas<br>of the highest<br>fluctuation in<br>the simulation
GROMACS API->>Queue Manager: Sending back<br>result files*
Queue Manager->>Server: Notifying about<br>finished simulation
Server->>User: Notifying about<br>finished simulation<br>via email address
Note left of User: Can access<br>project via<br>link provided<br>in the email<br>or<br>searching<br>for it in our<br>service
Note left of User: Can access results<br>of the simulation<br>in form of Mol*<br>visualization
``` -->
![uml diagram](https://github.com/KrzysztofMularski/ProProtein/blob/main/server/app/public/images/uml.png?raw=true)

\* Uml diagram made with help of [mermaid](https://github.com/mermaid-js/mermaid)

\* Queue Manager and GROMACS API containers are connected by Docker volume. This makes accessing the same files more easily without having to sending them via HTTP requests.

## Citing

When using ProProtein, please cite:

Daria Głębowska, Dawid Makałowski, Krzysztof Mularski, Marcin Okonek, dr hab. inż. Aleksandra Świercz, dr hab. inż. Maciej Antczak: ProProtein: Web service for making and visualizing molecular dynamics simulations which speeds up conducting research, Engineering Thesis, Politechnika Poznańska, WIiT, 2022.
