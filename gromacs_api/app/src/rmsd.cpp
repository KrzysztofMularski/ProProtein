#include <chrono>
#include <ctime>
#include <iostream>
#include <fstream>
#include <vector>
#include <Eigen/Geometry>
using namespace std;

//default input values
string inputFile = "trajBig.pdb";
string outputFile = "output.txt";
int spheresAllocationFrame = 0;
double RMSDThreshPercent = 50;

//additional parameters
double sphereRadius = 8;

int SPHERES;
int ATOMS;
int FRAMES;
double highestSize;

//Atoms[<frame>][<atom>][<coordinate>]
vector<vector<vector<double>>> A;

//RMSDValue[<frame>][<sphere>]
vector<vector<double>> C;

//Maps sphere to CA; CAAtomNumber[<sphere>]
vector<int> sphereCA;

//Numer of atoms in [<sphere>]
vector<int> sphereSize;

struct sphere
{
    int frame;
    int index;
    double RMSD;
};

vector<vector<int>> sphereAtoms;
vector<vector<int>> atomToSphere;
vector<vector<double>> highestRMSD;
vector<sphere> highestRMSDbase;



bool operator <(const sphere& lhs, const sphere& rhs)
{
    return lhs.RMSD < rhs.RMSD;
}

vector<string> result;


//--------------------------------------------------

//reading data from input pdb file.
void readFile(string filename)
{
    string line;
    ifstream myfile(filename);
    if (myfile.is_open())
    {
        int frame = 0;
        int atom;
        SPHERES = 0;
        FRAMES = 0;
        ATOMS = 0;
        A = {};
        sphereCA = {};
        sphereSize = {};
        while (getline(myfile, line))
        {
            if (line[0] == 'M')
            {
                frame = stoi(line.substr(9, 5));
                frame--;
                A.push_back({});
                C.push_back({});
                FRAMES++;
            }
            else if (line[0] == 'A')
            {
                atom = stoi(line.substr(6, 5));
                atom--;
                A[frame].push_back({});
                A[frame][atom].push_back(stod(line.substr(30, 8)));
                A[frame][atom].push_back(stod(line.substr(38, 8)));
                A[frame][atom].push_back(stod(line.substr(46, 8)));
                if (frame == 0)
                {
                    ATOMS++;
                    if (line[14] == 'A' and line[13] == 'C')
                    {
                        sphereCA.push_back(atom);
                        sphereSize.push_back(0);
                        SPHERES++;
                    }
                }
            }
        }
        myfile.close();
    }
    else 
    {
        cout << "Nie odnaleziono pliku!" << endl;
    }
}

//calculating distance between 2 atoms, used when allocating atoms to spheres.
double atomsDistanceCalc(int atom1, int atom2)
{
    double result = sqrt(pow(A[spheresAllocationFrame][atom1][0] - A[spheresAllocationFrame][atom2][0], 2) +
        pow(A[spheresAllocationFrame][atom1][1] - A[spheresAllocationFrame][atom2][1], 2) +
        pow(A[spheresAllocationFrame][atom1][2] - A[spheresAllocationFrame][atom2][2], 2));
    return result;
}

//allocating atoms into spheres, based on sphereRadius
void atomsAllocation()
{
    auto timestamp = std::chrono::system_clock::now();
    std::time_t timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    int checkpoint = 0;
    sphereAtoms = {};
    atomToSphere = {};
    for (int i = 0; i < SPHERES; i++)
    {
        sphereAtoms.push_back({});
    }
    for (int i = 0; i < ATOMS; i++)
    {
        atomToSphere.push_back({});
        for (int j = 0; j < SPHERES; j++)
        {
            if (atomsDistanceCalc(i, sphereCA[j]) <= sphereRadius)
            {
                atomToSphere[i].push_back(j);
                sphereAtoms[j].push_back(i);
                sphereSize[j]++;
            }
        }
        if ((i - checkpoint) >= 0.1 * ATOMS)
        {
            checkpoint = i;
            timestamp = std::chrono::system_clock::now();
            timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
            cout << "[RMSD] Atom number " << i + 1 << " of " << ATOMS << " allocated to spheres at " << std::ctime(&timestamp_print) << endl;
        }
    }
}

// Find3DAffineTransform is from oleg-alexandrov repository on github, available here https://github.com/oleg-alexandrov/projects/blob/master/eigen/Kabsch.cpp [as of 27.01.2022]
// Given two sets of 3D points, find the rotation + translation + scale
// which best maps the first set to the second.
// Source: http://en.wikipedia.org/wiki/Kabsch_algorithm

// The input 3D points are stored as columns.
Eigen::Affine3d Find3DAffineTransform(Eigen::Matrix3Xd in, Eigen::Matrix3Xd out) {

    // Default output
    Eigen::Affine3d A;
    A.linear() = Eigen::Matrix3d::Identity(3, 3);
    A.translation() = Eigen::Vector3d::Zero();

    if (in.cols() != out.cols())
        throw "Find3DAffineTransform(): input data mis-match";

    // First find the scale, by finding the ratio of sums of some distances,
    // then bring the datasets to the same scale.
    double dist_in = 0, dist_out = 0;
    for (int col = 0; col < in.cols() - 1; col++) {
        dist_in += (in.col(col + 1) - in.col(col)).norm();
        dist_out += (out.col(col + 1) - out.col(col)).norm();
    }
    if (dist_in <= 0 || dist_out <= 0)
        return A;
    double scale = dist_out / dist_in;
    out /= scale;

    // Find the centroids then shift to the origin
    Eigen::Vector3d in_ctr = Eigen::Vector3d::Zero();
    Eigen::Vector3d out_ctr = Eigen::Vector3d::Zero();
    for (int col = 0; col < in.cols(); col++) {
        in_ctr += in.col(col);
        out_ctr += out.col(col);
    }
    in_ctr /= in.cols();
    out_ctr /= out.cols();
    for (int col = 0; col < in.cols(); col++) {
        in.col(col) -= in_ctr;
        out.col(col) -= out_ctr;
    }

    // SVD
    Eigen::MatrixXd Cov = in * out.transpose();
    Eigen::JacobiSVD<Eigen::MatrixXd> svd(Cov, Eigen::ComputeThinU | Eigen::ComputeThinV);

    // Find the rotation
    double d = (svd.matrixV() * svd.matrixU().transpose()).determinant();
    if (d > 0)
        d = 1.0;
    else
        d = -1.0;
    Eigen::Matrix3d I = Eigen::Matrix3d::Identity(3, 3);
    I(2, 2) = d;
    Eigen::Matrix3d R = svd.matrixV() * I * svd.matrixU().transpose();

    // The final transform
    A.linear() = scale * R;
    A.translation() = scale * (out_ctr - R * in_ctr);

    return A;
}

//superpose changes vector of atoms frame 2 to map atoms from frame 1 in the way to minimise RMSD between both frames
void superpose(const vector<vector<double>>& frame1, vector<vector<double>>& frame2)
{
    int atomsInSphere = frame1.size();
    Eigen::Matrix3Xd S1(3, atomsInSphere);
    Eigen::Matrix3Xd S2(3, atomsInSphere);
    for (int j = 0; j < atomsInSphere; j++)
    {
        for (int k = 0; k < 3; k++)
        {
            S1(k, j) = frame1[j][k];
            S2(k, j) = frame2[j][k];
        }
    }
    Eigen::Affine3d RT = Find3DAffineTransform(S2, S1);
    S2 = RT.linear() * S2;
    for (int j = 0; j < atomsInSphere; j++)
    {
        S2.block<3, 1>(0, j) += RT.translation();
    }
    for (int j = 0; j < atomsInSphere; j++)
    {
        for (int k = 0; k < 3; k++)
        {
            frame2[j][k] = S2(k, j);
        }
    }
}

//initializing vector for RMSD values
void initializeC()
{
    C = {};
    for (int i = 0; i < FRAMES; i++)
    {
        C.push_back({});
        for (int j = 0; j < SPHERES; j++)
            C[i].push_back(0);
    }
}

//calculating RMSD on spheres, on adjacent frames
void calculateRMSDSuperpose()
{
    initializeC();
    vector<vector<vector<double>>> sphereMatrix;
    vector<vector<double>> tempMatrix;
    double tempRMSD;
    auto timestamp = std::chrono::system_clock::now();
    std::time_t timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    int checkpoint = 0;
    for (int s = 0; s < SPHERES; s++)
    {
        int atomsInSphere = sphereAtoms[s].size();
        sphereMatrix = {};
        for (int i = 0; i < FRAMES; i++)
        {
            sphereMatrix.push_back({});
            for (int j = 0; j < atomsInSphere; j++)
            {
                sphereMatrix[i].push_back(A[i][sphereAtoms[s][j]]);
            }
            if (i > 0)
            {
                tempMatrix = sphereMatrix[i];
                superpose(sphereMatrix[i - 1], tempMatrix);
                for (int j = 0; j < atomsInSphere; j++)
                {
                    for (int k = 0; k < 3; k++)
                    {
                        tempRMSD = pow(tempMatrix[j][k] - sphereMatrix[i - 1][j][k], 2);
                        C[i - 1][s] += tempRMSD;
                    }
                }
                C[i - 1][s] /= ((long)atomsInSphere * (long)3);
                C[i - 1][s] = sqrt(C[i - 1][s]);
            }
        }
        if ((s - checkpoint) >= 0.1 * SPHERES)
        {
            checkpoint = s;
            timestamp = std::chrono::system_clock::now();
            timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
            cout << "[RMSD] RMSD calculated for " << s + 1 << " of " << SPHERES << " spheres at " << std::ctime(&timestamp_print) << endl;
        }
    }
}

//initializing vector for storing information about spheres with highest RMSD
void initializeHighestRMSD()
{
    highestRMSD = {};
    highestSize = (double)SPHERES / 100;
    highestSize *= (long)(FRAMES - 1);
    highestSize *= RMSDThreshPercent;
    for (int i = 0; i < highestSize; i++)
    {
        highestRMSD.push_back({});
        for (int j = 0; j < 3; j++)
            highestRMSD[i].push_back(-1);
    }
}

//choosing frames and spheres with highest RMSD, they will be colored later
void chooseHighestRMSD()
{
    initializeHighestRMSD();
    for (int i = 0; i < FRAMES - 1; i++)
    {
        for (int j = 0; j < SPHERES; j++)
        {
            for (unsigned int k = 0; k < highestRMSD.size(); k++)
            {
                if (C[i][j] > highestRMSD[k][2])
                {
                    for (int l = highestRMSD.size() - 1; l > k; l--)
                    {
                        for (int m = 0; m < 3; m++)
                        {
                            highestRMSD[l][m] = highestRMSD[l - 1][m];
                        }
                    }
                    highestRMSD[k][0] = i;
                    highestRMSD[k][1] = j;
                    highestRMSD[k][2] = C[i][j];
                    break;
                }
            }
        }
    }
}

//choosing frames and spheres with highest RMSD, they will be colored later
void chooseHighestRMSDquick()
{
    auto timestamp = std::chrono::system_clock::now();
    std::time_t timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    initializeHighestRMSD();
    int counter = 0;
    for (int i = 0; i < FRAMES - 1; i++)
    {
        for (int j = 0; j < SPHERES; j++)
        {
            highestRMSDbase.push_back(sphere());
            highestRMSDbase[counter].frame = i;
            highestRMSDbase[counter].index = j;
            highestRMSDbase[counter].RMSD = C[i][j];
        }
    }
    timestamp = std::chrono::system_clock::now();
    timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] RMSD started being sorted at " << std::ctime(&timestamp_print) << endl;
    sort(highestRMSDbase.begin(), highestRMSDbase.end());
    timestamp = std::chrono::system_clock::now();
    timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] RMSD sorted at " << std::ctime(&timestamp_print) << endl;
    for (unsigned int k = 0; k < highestRMSD.size(); k++)
    {
        highestRMSD[k][0] = highestRMSDbase[k].frame;
        highestRMSD[k][1] = highestRMSDbase[k].index;
        highestRMSD[k][2] = highestRMSDbase[k].RMSD;
    }
}

//calculates result variable content, basen on highestRMSD
void calculateResult()
{
    result = {};
    int numberOfSpheresToColor = highestRMSD.size();
    vector<vector<int>> resultSpheres;
    for (int i = 0; i < FRAMES - 1; i++)
    {
        resultSpheres.push_back({});
    }
    for (int i = 0; i < numberOfSpheresToColor; i++)
    {
        resultSpheres[highestRMSD[i][0]].push_back(highestRMSD[i][1]);
    }
    string subResult;
    for (int i = 0; i < FRAMES - 1; i++)
    {
        subResult = "";
        for (int j = 0; j < numberOfSpheresToColor; j++)
        {
            if (highestRMSD[j][0] == i)
            {
                stringstream ss;
                string s;
                ss << sphereCA[highestRMSD[j][1]];
                ss >> s;
                subResult += s + " ";
            }
        }
        result.push_back(subResult);
    }
}

//saving results to an output file
void saveToFile(string filename)
{
    ofstream myfile(filename);
    if (myfile.is_open())
    {
        for (int i = 0; i < FRAMES - 1; i++)
        {
            if (!result[i].empty())
            {
                myfile << i << ' ' << result[i] << endl;
            }
        }
        myfile.close();
    }
}

//debug function for checking superpose results
void makePDB(string filename)
{
    vector<vector<vector<double>>> sphereMatrix;
    int atomsInSphere = sphereAtoms[0].size();
    sphereMatrix = {};
    for (int i = 0; i < 2; i++)
    {
        sphereMatrix.push_back({});
        for (int j = 0; j < atomsInSphere; j++)
        {
            sphereMatrix[i].push_back(A[i][sphereAtoms[0][j]]);
        }
        if (i > 0)
        {
            superpose(sphereMatrix[i - 1], sphereMatrix[i]);
        }
    }
    string line;
    ifstream myfilein(filename);
    filename += "out";
    ofstream myfileout("testBase.pdb");
    ofstream myfilesuper("testSuperpose.pdb");
    int counter = 0;
    if (myfilein.is_open() && myfileout.is_open())
    {
        int frame = 0;
        int atom;
        while (getline(myfilein, line))
        {
            if (line[0] == 'M')
            {
                myfileout << line << endl;
                myfilesuper << line << endl;
            }
            
            if (line[0] == 'E')
            {
                myfileout << line << endl;
                myfilesuper << line << endl;
                frame++;
                if (frame > 1)
                {
                    break;
                }
            }
            if (line[0] == 'A')
            {
                atom = stoi(line.substr(6, 5));
                atom--;
                for (unsigned int i = 0; i < sphereAtoms[0].size(); i++)
                {
                    if (sphereAtoms[0][i] == atom)
                    {
                        myfileout << line << endl;
                        if (frame == 1)
                        {                            
                            line.replace(32, 6, to_string(sphereMatrix[1][counter][0]), 0, 6);
                            line.replace(40, 6, to_string(sphereMatrix[1][counter][1]), 0, 6);
                            line.replace(48, 6, to_string(sphereMatrix[1][counter][2]), 0, 6);
                            myfilesuper << line << endl;
                            counter++;
                        }
                        else
                        {
                            myfilesuper << line << endl;
                        }
                    }
                }
            }
        }
        myfilein.close();
        myfileout.close();
        myfilesuper.close();
    }
}

int main(int argc, char* argv[])
{
    auto start = chrono::high_resolution_clock::now();
    if (argc == 5)
    {
        inputFile = string(argv[1]);
        outputFile = string(argv[2]);
        spheresAllocationFrame = stoi(argv[3]) - 1;
        RMSDThreshPercent = stod(argv[4]);
    }
    readFile(inputFile);
    if (spheresAllocationFrame < 0)
    {
        spheresAllocationFrame = 1;
    }
    else if (spheresAllocationFrame >= FRAMES)
    {
        spheresAllocationFrame = FRAMES - 1;
    }
    auto timestamp = std::chrono::system_clock::now();
    std::time_t timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] Input file: " << inputFile << " loaded at " << std::ctime(&timestamp_print) << endl;
    atomsAllocation();
    timestamp = std::chrono::system_clock::now();
    timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] Atoms allocated to spheres at " << std::ctime(&timestamp_print) << endl;
    calculateRMSDSuperpose();
    chooseHighestRMSDquick();
    calculateResult();
    saveToFile(outputFile);
    timestamp = std::chrono::system_clock::now();
    timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] Output file: " << outputFile << " saved at " << std::ctime(&timestamp_print) << endl;
    //makePDB(inputFile);
    auto stop = chrono::high_resolution_clock::now();
    chrono::duration<double> elapsed = stop - start;
    timestamp = std::chrono::system_clock::now();
    timestamp_print = std::chrono::system_clock::to_time_t(timestamp);
    cout << "[RMSD] Computation time: " << elapsed.count() << "s, ended at: " << std::ctime(&timestamp_print) << endl;
}
