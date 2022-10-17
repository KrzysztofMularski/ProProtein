FROM gromacs/gromacs

RUN rm /etc/apt/sources.list.d/cuda.list
RUN rm /etc/apt/sources.list.d/nvidia-ml.list

RUN apt-get update\
	&& apt-get upgrade -y\
	&& apt install curl -y\
	&& curl -sL https://deb.nodesource.com/setup_17.x | bash -\
	&& apt-get install nodejs -y\
	&& apt install g++ -y\
	&& apt install libeigen3-dev -y

COPY app /home/app

WORKDIR /home/app

RUN npm install\
    && g++ -I /usr/include/eigen3/ /home/app/src/rmsd.cpp -o /bin/rmsd

CMD ["node", "/home/app/src/app.js"]
