FROM gromacs/gromacs

RUN rm /etc/apt/sources.list.d/cuda.list
# RUN rm /etc/apt/sources.list.d/nvidia-ml.list

RUN apt-get update\
	&& apt-get upgrade -y\
	&& apt install curl -y\
	&& curl -sL https://deb.nodesource.com/setup_18.x | bash -\
	&& curl -sL https://files.pythonhosted.org/packages/bc/07/830784e061fb94d67649f3e438ff63cfb902dec6d48ac75aeaaac7c7c30e/Pillow-9.4.0.tar.gz\
	&& apt-get install nodejs -y\
	&& apt-get install graphicsmagick-imagemagick-compat -y\
	&& apt-get install grace -y\
	&& apt install g++ -y\
	&& apt install libeigen3-dev -y

COPY app /home/app

WORKDIR /home/app

RUN npm install\
    && g++ -I /usr/include/eigen3/ /home/app/src/rmsd.cpp -o /bin/rmsd

CMD ["node", "/home/app/src/app.js"]
